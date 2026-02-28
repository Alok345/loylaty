
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import admin from "firebase-admin";

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    try {
        // Construct service account from environment variables
        const serviceAccount = {
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            // Replace literal \n with actual newlines if they are escaped in the env var
            privateKey: process.env.FIREBASE_PRIVATE_KEY
                ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
                : undefined,
        };

        if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
            console.warn("Missing Firebase Admin environment variables. Push notifications will not work.");
        } else {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: serviceAccount.projectId,
            });
        }
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
                .from("profiles")
                .select("id, full_name, email, nearest_store, role, auth_token")
                .eq("nearest_store", targetValue);

            if (error) throw new Error(`Error fetching store users: ${error.message}`);
            users = usersData || [];
        } else if (targetType === "occupation") {
            const { data: usersData, error } = await supabase
                .from("profiles")
                .select("id, full_name, email, nearest_store, role, auth_token")
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

        // 3. Fetch FCM Tokens from Profiles as well (potential fallback or primary storage)
        const { data: profilesData, error: profilesError } = await supabase
            .from("profiles")
            .select("id, auth_token, user_id")
            .in("id", userIds);

        if (profilesError) console.warn("Error fetching profiles by id:", profilesError);

        let finalProfiles = profilesData || [];

        // Check if we need to search by user_id instead (if profiles.id != user.id)
        if (userIds.length > 0) {
            const { data: profilesByUserId, error: error2 } = await supabase
                .from("profiles")
                .select("id, auth_token, user_id")
                .in("user_id", userIds);

            if (error2) console.warn("Error fetching profiles by user_id:", error2);

            if (profilesByUserId && profilesByUserId.length > 0) {
                finalProfiles = [...finalProfiles, ...profilesByUserId];
            }
        }

        // Deduplicate profiles and map to user ID
        let profilesMap = {};
        if (finalProfiles) {
            finalProfiles.forEach(p => {
                const token = p.auth_token;
                if (token) {
                    if (userIds.includes(p.id)) profilesMap[p.id] = token;
                    if (p.user_id && userIds.includes(p.user_id)) profilesMap[p.user_id] = token;
                }
            });
        }

        // 4. Send Notifications
        const messages = [];
        const notificationRecords = [];

        for (const user of users) {
            // Priority: token from users table, then fallback to profiles table
            const token = user.auth_token || profilesMap[user.id];

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
