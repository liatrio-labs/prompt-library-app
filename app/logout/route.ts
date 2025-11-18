import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/utils/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const redirectTo = new URL('/login', req.url);
  return NextResponse.redirect(redirectTo);
}
