import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "../lib/supabase";

WebBrowser.maybeCompleteAuthSession();

export async function signInWithGoogle() {
  const redirectTo = AuthSession.makeRedirectUri({
    scheme: "theneatifyteam",
    path: "google-auth",
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;

  if (data?.url) {
    await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  }
}