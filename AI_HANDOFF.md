# AI Handoff Document - Prompt Library Multi-User Implementation

## 📋 Project Context

We're converting a single-user, localStorage-based prompt library management tool into a multi-user SaaS application for Liatrio employees with Google authentication and Supabase backend.

**Original App**: Static HTML file with localStorage (https://github.com/goossaert/prompt-library)
**New App Repository**: https://github.com/liatrio-labs/prompt-library-app
**Current Deployment**: Running locally with ngrok at https://jg.ngrok.io

## ✅ Phase 1: COMPLETED

Successfully migrated the application to Next.js with TypeScript:

### What's Working Now:
- ✅ Full Next.js 16 app with TypeScript and Tailwind CSS
- ✅ All original features migrated to React components:
  - Prompt creation, editing, deletion
  - Variable substitution: `${variable}`
  - Template markers: `[text]`
  - Optional parts: `{{text}}`
  - Global templates: `<<key>>`
  - Categories and tags
  - Search functionality
  - Dark mode (light/dark/system)
  - Import/Export JSON
  - Trash with 30-day auto-purge
- ✅ Responsive design (mobile + desktop)
- ✅ Currently uses localStorage (client-side only)
- ✅ Client tested and approved the UI/UX

### Tech Stack:
- Next.js 16.0.3 (App Router)
- TypeScript
- Tailwind CSS
- React 19
- Font Awesome 6.4.0

### Project Structure:
```
prompt-library-app/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Home (renders PromptLibrary)
│   └── globals.css         # Global styles
├── components/
│   └── PromptLibrary.tsx   # Main component (~700 lines, all logic)
├── types/
│   └── prompt.ts           # TypeScript interfaces
├── start.sh                # Local dev + ngrok start script
├── stop.sh                 # Stop services script
└── QUICKSTART.md           # Local dev documentation
```

### Current Data Model:
```typescript
interface Prompt {
  id: string;
  name: string;
  tags: string[];
  category: string;
  history: PromptHistory[];
  createdAt: string;
  updatedAt: string;
  trashed: boolean;
  trashedAt?: string;
}

interface PromptHistory {
  content: string;
  savedAt: string;
  versionName: string;
}

interface GlobalTemplates {
  [key: string]: string;
}
```

## 🎯 Phase 2: Authentication (NEXT PRIORITY)

### Requirements:
1. **Google OAuth Integration**
   - Restrict to `@liatrio.com` email domain ONLY
   - No other email domains should be able to access
   - User needs to create Google OAuth credentials for Liatrio domain

2. **Authentication Provider Options:**
   - **Preferred**: Supabase Auth with Google OAuth provider
   - **Alternative**: NextAuth.js v5 (if Supabase Auth has issues)

3. **Protected Routes:**
   - Entire app should be behind authentication
   - Redirect unauthenticated users to login page
   - Show user email/avatar in header
   - Add logout button

### User Setup Required:
- User needs to create Google OAuth credentials at https://console.cloud.google.com
- Will need Client ID and Client Secret
- User will need to set up Supabase project (they requested setup help)

## 🎯 Phase 3: Multi-User Database (AFTER AUTH)

### Requirements:

1. **Supabase Database Schema:**

**Users Table:**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Prompts Table:**
```sql
CREATE TABLE prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tags TEXT[],
  category TEXT NOT NULL,
  content TEXT NOT NULL,  -- Current version content
  is_public BOOLEAN DEFAULT FALSE,
  trashed BOOLEAN DEFAULT FALSE,
  trashed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_prompts_user_id ON prompts(user_id);
CREATE INDEX idx_prompts_trashed ON prompts(trashed);
CREATE INDEX idx_prompts_is_public ON prompts(is_public);
```

**Prompt History Table:**
```sql
CREATE TABLE prompt_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  version_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_prompt_history_prompt_id ON prompt_history(prompt_id);
```

**Global Templates Table:**
```sql
CREATE TABLE global_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, key)
);

CREATE INDEX idx_global_templates_user_id ON global_templates(user_id);
CREATE INDEX idx_global_templates_is_public ON global_templates(is_public);
```

2. **Row Level Security (RLS) Policies:**
   - Users can read their own prompts + public prompts from any Liatrio user
   - Users can only update/delete their own prompts
   - Users can make their private prompts public (but not vice versa without permission)
   - Same rules apply to global templates

3. **Public/Private Sharing:**
   - **Default**: All new prompts are SHARED (visible to all @liatrio.com users)
   - **Option**: User can mark prompts as PRIVATE (only they can see)
   - **Option**: User can make PRIVATE prompts PUBLIC (share with team)
   - Add toggle in UI: "Share with Liatrio team" (default ON)

4. **UI Changes Needed:**
   - Add "Private/Public" toggle on prompt composer
   - Show visibility indicator on prompt cards
   - Add filter: "My Prompts" vs "Team Prompts" vs "All"
   - Add user attribution: "Created by [name]" on shared prompts

### Data Migration Strategy:
- Users will lose their localStorage data when we switch to Supabase
- Create an "Import from JSON" feature to help users migrate their existing prompts
- Could also offer a one-time localStorage → Supabase migration on first login

## 🚀 Deployment to Vercel

### Current Status:
- Vercel MCP server is connected and authenticated
- User is part of `liatrio-innovation` team (team_yvdjb71Onu70fAy7abppXZYA)
- GitHub repo exists at: https://github.com/liatrio-labs/prompt-library-app

### Deployment Steps:
1. Connect the GitHub repository to Vercel under `liatrio-innovation` team
2. Set environment variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
   ```
3. Deploy to production
4. Configure custom domain if needed

### Notes:
- Use Vercel's built-in deployment from GitHub
- Auto-deploy on push to main branch
- Environment variables should be set in Vercel dashboard

## 📝 Key Implementation Notes

1. **Don't Break Existing Features:**
   - All variable syntax must continue working: `${var}`, `[text]`, `{{text}}`, `<<key>>`
   - Preview functionality is critical
   - Dark mode must persist
   - Mobile responsiveness is important

2. **Keep It Simple:**
   - Start with basic auth (just Google OAuth)
   - Don't over-engineer the sharing system
   - Default to "shared" to encourage team collaboration

3. **User Experience:**
   - Minimize friction - auto-login if session exists
   - Clear indication of public vs private prompts
   - Easy way to see who created a shared prompt

## 🔑 What You'll Need from User

1. **Google OAuth Credentials:**
   - Client ID
   - Client Secret
   - Authorized redirect URIs configured

2. **Supabase Project:**
   - Project URL
   - Anon/Public key
   - Service role key (for server-side operations)
   - Database connection string (if needed)

3. **Decisions:**
   - Confirm default behavior: "Share with team" ON by default?
   - Can users see ALL prompts or just their own + public?
   - Should there be categories like "My Prompts", "Team Prompts", etc.?

## 🎯 Immediate Next Steps

1. Help user set up Supabase project
2. Help user create Google OAuth credentials with Liatrio domain restriction
3. Implement authentication layer (Supabase Auth + Google OAuth)
4. Create database schema in Supabase
5. Migrate component from localStorage to Supabase
6. Add public/private toggle UI
7. Deploy to Vercel
8. Test with multiple @liatrio.com users

## 📞 Contact & Context

- User has tested and approved the current Next.js implementation
- User has a paid ngrok account with custom domain (jg.ngrok.io)
- User is comfortable with command line and git
- User wants an iterative approach (deploy basic, then add features)
- Priority is getting multi-user working for Liatrio team

## 🚨 Important Constraints

1. **MUST restrict to @liatrio.com emails only**
2. **MUST maintain all existing prompt features**
3. **MUST be deployed to Vercel (not other platforms)**
4. **MUST use Supabase for database (preferred by user)**
5. **Default prompts to SHARED** (not private)

---

**TL;DR**: We have a working Next.js prompt library app. Now we need to add Google OAuth (Liatrio domain only), connect to Supabase database, enable multi-user prompt sharing (default shared, option for private), and deploy to Vercel under the liatrio-innovation team.
