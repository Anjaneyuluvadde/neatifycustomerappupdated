import { supabase } from "./supabase";

export const invokeFunction = async (functionName: string, options: any = {}) => {
  console.log(`⚡ [Supabase Edge Function] Invoking: ${functionName}`);
  return supabase.functions.invoke(functionName, options);
};

