
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import admin from "firebase-admin";
import serviceAccount from "../../../serviceKey.json";

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: serviceAccount.project_id,
        });
    } catch (error) {
        console.error("Firebase admin initialization error", error);
    }
}

export async function POST(req) {
    try {
        const body = await req.json();
        const { targetType, targetValue, title, message } = body;

        // 1. Verify Authentication & Initialize Supabase Client
        const cookieStore = await cookies();

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll();
                    },
                    setAll(cookiesToSet) {
                        try {
                            cookiesToSet.forEach(({ name, value, options }) =>
                                cookieStore.set(name, value, options)
                            );
                        } catch {
                            // The `setAll` method was called from a Server Component.
                            // This can be ignored if you have middleware refreshing
                            // user sessions.
                        }
                    },
                },
            }
        );

        // Verify session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 2. Fetch Target Users
        let users = [];

        if (targetType === "store") {
            const { data: usersData, error } = await supabase
                .from("users")
                .select("id, full_name, email, nearest_store, role")
                .eq("nearest_store", targetValue);

            if (error) throw new Error(`Error fetching store users: ${error.message}`);
            users = usersData || [];
        } else if (targetType === "occupation") {
            const { data: usersData, error } = await supabase
                .from("users")
                .select("id, full_name, email, nearest_store, role")
                .ilike("role", targetValue); // Case insensitive match for safety

            if (error) throw new Error(`Error fetching occupation users: ${error.message}`);
            users = usersData || [];
        } else {
            return NextResponse.json({ error: "Invalid target type" }, { status: 400 });
        }

        if (users.length === 0) {
            return NextResponse.json({ successCount: 0, message: "No users found for this target." });
        }

        const userIds = users.map(u => u.id);

        // 3. Fetch FCM Tokens from Profiles
        // We try to fetch from profiles table.
        // Assuming profiles are linked by `id` (as it is often 1:1 with auth.users)
        // or `user_id`.
        const { data: profilesData, error: profilesError } = await supabase
            .from("profiles")
            .select("id, auth_token, user_id")
            .in("id", userIds); // Try matching by ID first (common in Supabase auth linking)

        // Fallback: Check if user_id column exists? No, standard query above.
        // If empty or mismatch, maybe try joining on user_id?
        let finalProfiles = profilesData || [];

        // Check if we need to search by user_id instead (if profiles.id != user.id)
        // We can do both queries to be safe if schema is unknown.
        if (userIds.length > 0) {
            const { data: profilesByUserId, error: error2 } = await supabase
                .from("profiles")
                .select("id, auth_token, user_id")
                .in("user_id", userIds);

            if (profilesByUserId && profilesByUserId.length > 0) {
                // Merge or prioritize? Profiles by user_id are more explicit.
                // Let's add them to the list.
                finalProfiles = [...finalProfiles, ...profilesByUserId];
            }
        }

        // Deduplicate profiles and map to user ID
        let profilesMap = {};
        if (finalProfiles) {
            finalProfiles.forEach(p => {
                if (p.auth_token) {
                    // If profile.id matches user.id
                    if (userIds.includes(p.id)) profilesMap[p.id] = p;
                    // Or if profile.user_id matches
                    if (p.user_id && userIds.includes(p.user_id)) profilesMap[p.user_id] = p;
                }
            });
        }

        // 4. Send Notifications
        const messages = [];
        const notificationRecords = [];

        for (const user of users) {
            const profile = profilesMap[user.id];
            const token = profile?.auth_token;

            if (token) {
                // Replace @ in message with user name
                const displayName = user.full_name || user.email?.split('@')[0] || "User";
                const personalizedMessage = message.replace(/@/g, displayName); // Replace all occurrences

                messages.push({
                    token: token,
                    notification: {
                        title: title,
                        body: personalizedMessage,
                    },
                    data: {
                        url: "/dashboard",
                    }
                });

                // Prepare record for database
                notificationRecords.push({
                    user_id: user.id,
                    title: title,
                    message: personalizedMessage,
                    is_read: false,
                    created_at: new Date().toISOString()
                });
            }
        }

        if (messages.length === 0) {
            return NextResponse.json({ successCount: 0, message: "No valid tokens found for target users." });
        }

        // Send in batches (FCM limit is 500)
        const batchSize = 500;
        let successCount = 0;

        // Split messages into batches
        for (let i = 0; i < messages.length; i += batchSize) {
            const batch = messages.slice(i, i + batchSize);
            try {
                const response = await admin.messaging().sendEach(batch);
                successCount += response.successCount;
                if (response.failureCount > 0) {
                    console.warn(`Failed to send ${response.failureCount} messages in batch ${i / batchSize + 1}`);
                    response.responses.forEach((resp, idx) => {
                        if (!resp.success) {
                            console.error(`Error sending to ${batch[idx].token}:`, resp.error);
                        }
                    });
                }
            } catch (err) {
                console.error("Error sending batch:", err);
            }
        }

        // 5. Insert Records into Notification Table
        if (notificationRecords.length > 0) {
            const { error: insertError } = await supabase
                .from("notifications")
                .insert(notificationRecords);

            if (insertError) console.error("Error inserting notification logs:", insertError);
        }

        return NextResponse.json({ successCount });

    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
