import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/utils/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { searchParams } = new URL(req.url);

  const code = searchParams.get('code');
  const redirect = searchParams.get('redirect') || '/';

  if (!code) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const { error, data } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session?.user) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Enforce domain restriction server-side
  const email = data.session.user.email || '';
  if (!email.endsWith('@liatrio.com')) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.redirect(new URL(redirect, req.url));
}
