import { convertPhoneToEmail } from "@/lib/authHelpers";
import { supabase } from "@/lib/supabase";

export const signInWithPhone = async (phone, password) => {
  const dummyEmail = convertPhoneToEmail(phone);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: dummyEmail,
    password: password,
  });

  if (error) {
    console.error("Login failed:", error.message);
    return { success: false, message: "Invalid phone or password" };
  }

  console.log("User logged in:", data.user);
  return { success: true, session: data.session };
};