import PromptLibrary from '@/components/PromptLibrary';
import { createSupabaseServerClient } from '@/utils/supabase/server';

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email ?? null;

  return <PromptLibrary userEmail={email} />;
}
