import { type FormEvent, type ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn as ClerkSignIn, SignUp as ClerkSignUp, useAuth, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  ArrowRight, BarChart3, BookOpen, Bot, Check, ChevronRight, CircleAlert, Clock3,
  FileQuestion, Filter, Globe2, LayoutDashboard, Library,
  Lightbulb, LockKeyhole, LogOut, Menu, Plus, RefreshCw, Search, Send, Settings as SettingsIcon,
  ShieldAlert, ShieldCheck, Sparkles, Target, Users, X,
} from 'lucide-react';
import {
  getGetCurrentUserQueryKey, getGetExamsQueryKey, getGetQuestionsQueryKey, useAskTutor, useCheckSecurityHeaders,
  useCreateExam, useCreateQuestion, useGenerateQuestions, useGetCurrentUser,
  useGetDashboardSummary, useGetExams, useGetPublicQuestions, useGetQuestions,
  useGetSecurityCves,
} from '@workspace/api-client-react';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#247d71',
    colorForeground: '#1e3040',
    colorMutedForeground: '#64727b',
    colorDanger: '#bd3f38',
    colorBackground: '#fffdf9',
    colorInput: '#f5f1e9',
    colorInputForeground: '#1e3040',
    colorNeutral: '#d8d0c2',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '0.8rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fffdf9] rounded-2xl w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'font-display !text-[#1e3040]',
    headerSubtitle: '!text-[#64727b]',
    socialButtonsBlockButtonText: '!text-[#1e3040]',
    formFieldLabel: '!text-[#1e3040]',
    footerActionLink: '!text-[#247d71]',
    footerActionText: '!text-[#64727b]',
    dividerText: '!text-[#64727b]',
    alertText: '!text-[#bd3f38]',
    formButtonPrimary: 'bg-[#247d71] hover:bg-[#1f6d63]',
    formFieldInput: 'bg-[#f5f1e9] border-[#d8d0c2] !text-[#1e3040]',
    socialButtonsBlockButton: 'border-[#d8d0c2] bg-[#fffdf9]',
    main: 'gap-4',
  },
};

type IconType = typeof LayoutDashboard;

const navItems: { label: string; href: string; icon: IconType; note?: string }[] = [
  { label: 'Overview', href: '/', icon: LayoutDashboard },
  { label: 'Exam studio', href: '/exams', icon: BookOpen },
  { label: 'Question bank', href: '/questions', icon: Library },
  { label: 'AI workspace', href: '/ai', icon: Bot, note: 'reviewed' },
  { label: 'Security lab', href: '/security', icon: ShieldCheck },
];

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3" data-testid="link-brand">
      <span className="relative grid size-10 place-items-center rounded-xl bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar)]">
        <span className="absolute size-5 rounded-full border-2 border-current" />
        <span className="absolute h-2.5 w-0.5 rounded-full bg-current" />
        <span className="absolute h-0.5 w-2.5 rounded-full bg-current" />
      </span>
      {!compact && <span className="font-display text-[17px] font-extrabold tracking-[-.04em]">XADON <span className="font-mono text-[10px] font-medium tracking-[.12em] opacity-60">CBT</span></span>}
    </Link>
  );
}

function Button({ children, variant = 'primary', className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'quiet' | 'outline' | 'danger' }) {
  const styles = {
    primary: 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm hover:-translate-y-0.5 hover:shadow-md',
    quiet: 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))]',
    outline: 'border border-[hsl(var(--border))] bg-transparent text-[hsl(var(--foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]',
    danger: 'bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]',
  };
  return <button className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`} {...props}>{children}</button>;
}

function Input({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return <label className="grid gap-2 text-sm font-semibold text-[hsl(var(--foreground))]">{label && <span>{label}</span>}<input className="min-h-11 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3.5 text-sm outline-none transition focus:border-[hsl(var(--primary))] focus:ring-4 focus:ring-[hsl(var(--primary)/.12)] placeholder:text-[hsl(var(--muted-foreground))]" {...props} /></label>;
}

function LoadingRows({ count = 4 }: { count?: number }) {
  return <div className="grid gap-3" aria-label="Loading"><span className="sr-only">Loading content</span>{Array.from({ length: count }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-[hsl(var(--muted))]" />)}</div>;
}

function EmptyState({ icon: Icon = FileQuestion, title, copy, action }: { icon?: IconType; title: string; copy: string; action?: ReactNode }) {
  return <div className="grid justify-items-center rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card)/.5)] px-6 py-14 text-center"><span className="mb-4 grid size-12 place-items-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><Icon size={22} /></span><h3 className="font-display text-lg font-extrabold">{title}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-[hsl(var(--muted-foreground))]">{copy}</p>{action && <div className="mt-5">{action}</div>}</div>;
}

function ErrorState({ onRetry, message = 'We could not load this workspace.' }: { onRetry?: () => void; message?: string }) {
  return <div className="rounded-2xl border border-[hsl(var(--destructive)/.25)] bg-[hsl(var(--destructive)/.05)] p-6"><div className="flex gap-3"><CircleAlert className="mt-0.5 text-[hsl(var(--destructive))]" size={20} /><div><h3 className="font-bold">Something needs attention</h3><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{message}</p>{onRetry && <button onClick={onRetry} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[hsl(var(--primary))]" data-testid="button-retry"><RefreshCw size={14} /> Try again</button>}</div></div></div>;
}

function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const currentUser = useGetCurrentUser({ query: { retry: false, queryKey: getGetCurrentUserQueryKey() } });
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const user = currentUser.data;
  const initials = user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '—';

  function handleLogout() {
    void signOut({ redirectUrl: basePath || '/' }).then(() => {
      queryClient.clear();
      setLocation('/');
    });
  }

  return <div className="noise min-h-[100dvh] bg-[hsl(var(--background))]">
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[258px] flex-col bg-[hsl(var(--sidebar))] px-4 py-5 text-[hsl(var(--sidebar-foreground))] transition-transform duration-300 lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between px-2"><Logo /><button onClick={() => setMobileOpen(false)} className="rounded-lg p-2 lg:hidden" aria-label="Close navigation" data-testid="button-close-navigation"><X size={18} /></button></div>
      <div className="mt-10 px-2"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--sidebar-foreground)/.5)]">Workspace</p><nav className="mt-3 grid gap-1">{navItems.map(({ label, href, icon: Icon, note }) => <Link key={href} href={href} onClick={() => setMobileOpen(false)} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`} className={`group flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition ${location === href ? 'bg-[hsl(var(--sidebar-primary)/.16)] text-[hsl(var(--sidebar-primary))]' : 'text-[hsl(var(--sidebar-foreground)/.72)] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]'}`}><Icon size={18} /><span className="flex-1">{label}</span>{note && <span className="rounded bg-[hsl(var(--accent))] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[hsl(var(--accent-foreground))]">{note}</span>}</Link>)}</nav></div>
      <div className="mt-auto grid gap-1 px-2"><Link href="/settings" onClick={() => setMobileOpen(false)} data-testid="link-nav-settings" className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold ${location === '/settings' ? 'bg-[hsl(var(--sidebar-primary)/.16)] text-[hsl(var(--sidebar-primary))]' : 'text-[hsl(var(--sidebar-foreground)/.72)] hover:bg-[hsl(var(--sidebar-accent))]'}`}><SettingsIcon size={18} /> Settings</Link><button onClick={handleLogout} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold text-[hsl(var(--sidebar-foreground)/.72)] hover:bg-[hsl(var(--sidebar-accent))]" data-testid="button-logout"><LogOut size={18} /> Sign out</button></div>
      <div className="mt-5 flex items-center gap-3 border-t border-[hsl(var(--sidebar-border))] px-2 pt-4"><div className="grid size-9 place-items-center rounded-full bg-[hsl(var(--sidebar-primary))] font-display text-sm font-extrabold text-[hsl(var(--sidebar))]" data-testid="text-user-initials">{initials}</div><div className="min-w-0"><p className="truncate text-sm font-bold" data-testid="text-user-name">{user?.name || 'Secure session'}</p><p className="truncate font-mono text-[10px] text-[hsl(var(--sidebar-foreground)/.55)]">{user?.role || 'workspace'}</p></div></div>
    </aside>
    {mobileOpen && <button onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-[hsl(var(--sidebar)/.55)] lg:hidden" aria-label="Close navigation overlay" data-testid="button-navigation-overlay" />}
    <div className="lg:pl-[258px]"><header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-[hsl(var(--border)/.75)] bg-[hsl(var(--background)/.88)] px-5 backdrop-blur-xl sm:px-8"><button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 lg:hidden" aria-label="Open navigation" data-testid="button-open-navigation"><Menu size={21} /></button><div className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))] sm:flex"><span className="size-2 rounded-full bg-[hsl(var(--primary))] animate-pulse-soft" /> Secure workspace / {location === '/' ? 'overview' : location.slice(1)}</div><div className="ml-auto flex items-center gap-3"><span className="hidden text-right sm:block"><span className="block text-xs font-bold">Learning mode</span><span className="font-mono text-[10px] text-[hsl(var(--muted-foreground))]">Nigeria · WAT</span></span><div className="grid size-9 place-items-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] font-display text-xs font-extrabold text-[hsl(var(--primary))]">{initials}</div></div></header><main className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 sm:py-10">{currentUser.isLoading ? <div className="mx-auto max-w-6xl"><LoadingRows count={5} /></div> : currentUser.isError ? <div className="mx-auto max-w-6xl"><ErrorState message="Your session may have expired. Sign in again to continue." /></div> : children}</main></div>
  </div>;
}

function PageIntro({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="font-mono text-[10px] font-medium uppercase tracking-[.2em] text-[hsl(var(--primary))]">{eyebrow}</p><h1 className="mt-2 font-display text-3xl font-extrabold tracking-[-.05em] text-balance sm:text-4xl">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">{copy}</p></div>{action}</div>;
}

function StatCard({ label, value, meta, icon: Icon, accent = 'teal' }: { label: string; value: string | number; meta: string; icon: IconType; accent?: 'teal' | 'orange' | 'navy' }) {
  const colors = { teal: 'bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]', orange: 'bg-[hsl(var(--accent)/.18)] text-[hsl(25_67%_39%)]', navy: 'bg-[hsl(var(--sidebar)/.1)] text-[hsl(var(--sidebar))]' };
  return <div className="rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"><div className="flex items-start justify-between"><span className={`grid size-10 place-items-center rounded-xl ${colors[accent]}`}><Icon size={19} /></span><span className="font-mono text-[10px] text-[hsl(var(--muted-foreground))]">LIVE</span></div><p className="mt-6 font-mono text-[11px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">{label}</p><p className="mt-1 font-display text-3xl font-extrabold tracking-[-.06em]" data-testid={`stat-${label.toLowerCase().replaceAll(' ', '-')}`}>{value}</p><p className="mt-2 text-xs font-medium text-[hsl(var(--muted-foreground))]">{meta}</p></div>;
}

function Dashboard() {
  const summary = useGetDashboardSummary();
  const exams = useGetExams(undefined, { query: { retry: false, queryKey: getGetExamsQueryKey() } });
  const activity = summary.data?.recentActivity || [];
  return <div className="animate-rise">
    <PageIntro eyebrow="Good morning, learner" title="Your next clear step." copy="A focused view of what is moving today — practice, review, and the small wins that compound." action={<Link href="/ai" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 text-sm font-bold text-[hsl(var(--primary-foreground))] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" data-testid="link-dashboard-tutor">Ask the tutor <ArrowRight size={16} /></Link>} />
    {summary.isLoading ? <LoadingRows count={5} /> : summary.isError ? <ErrorState onRetry={() => summary.refetch()} /> : <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><StatCard label="Questions" value={summary.data?.questions ?? 0} meta="in your practice trail" icon={FileQuestion} /><StatCard label="Exams" value={summary.data?.exams ?? 0} meta="available to attempt" icon={BookOpen} accent="navy" /><StatCard label="Accuracy" value={`${summary.data?.accuracy ?? 0}%`} meta="across recent work" icon={Target} accent="orange" /><StatCard label="Study minutes" value={summary.data?.studyMinutes ?? 0} meta="this learning cycle" icon={Clock3} /><StatCard label="Day streak" value={summary.data?.streak ?? 0} meta="keep the thread going" icon={Sparkles} accent="orange" /></div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_.65fr]"><section className="surface-grid relative overflow-hidden rounded-2xl bg-[hsl(var(--sidebar))] p-6 text-[hsl(var(--sidebar-foreground))] sm:p-8"><div className="relative z-10 max-w-lg"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--sidebar-primary))]">The calm advantage</p><h2 className="mt-3 font-display text-2xl font-extrabold tracking-[-.05em] sm:text-3xl">Make your focus visible.</h2><p className="mt-3 text-sm leading-6 text-[hsl(var(--sidebar-foreground)/.68)]">Consistent, trusted practice beats last-minute pressure. Use XADON to spot the next topic worth your attention.</p><div className="mt-6 flex flex-wrap gap-3"><Link href="/questions" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[hsl(var(--sidebar-primary))] px-4 text-sm font-bold text-[hsl(var(--sidebar))]" data-testid="link-dashboard-practice">Open question bank <ArrowRight size={15} /></Link><span className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--sidebar-border))] px-4 text-xs font-semibold text-[hsl(var(--sidebar-foreground)/.7)]"><ShieldCheck size={15} /> Reviewed content</span></div></div><div className="absolute -right-7 -top-7 size-48 rounded-full border-[18px] border-[hsl(var(--sidebar-primary)/.1)] sm:size-64" /><div className="absolute -bottom-16 right-20 size-40 rounded-full border border-[hsl(var(--sidebar-primary)/.18)]" /></section>
      <section className="rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-6 shadow-[var(--shadow-sm)]"><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Recent signal</p><h2 className="mt-1 font-display text-xl font-extrabold">Activity log</h2></div><BarChart3 size={20} className="text-[hsl(var(--primary))]" /></div><div className="mt-5 grid gap-4">{activity.length === 0 ? <p className="py-6 text-sm text-[hsl(var(--muted-foreground))]">Your activity will appear here after your first session.</p> : activity.slice(0, 4).map((item) => <div key={item.id} className="flex gap-3"><span className="mt-1 size-2 shrink-0 rounded-full bg-[hsl(var(--accent))]" /><div><p className="text-sm font-semibold leading-5">{item.label}</p><p className="text-xs text-[hsl(var(--muted-foreground))]">{item.detail} · {item.time}</p></div></div>)}</div><Link href="/exams" className="mt-6 flex items-center justify-between border-t border-[hsl(var(--border))] pt-4 text-xs font-bold text-[hsl(var(--primary))]" data-testid="link-dashboard-exams">View exam studio <ChevronRight size={15} /></Link></section></div>
      <section className="mt-6"><div className="mb-4 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Suggested next</p><h2 className="mt-1 font-display text-xl font-extrabold">Open practice</h2></div><Link href="/exams" className="text-sm font-bold text-[hsl(var(--primary))]" data-testid="link-dashboard-all-exams">See all exams</Link></div>{exams.isLoading ? <LoadingRows count={2} /> : exams.isError ? <ErrorState onRetry={() => exams.refetch()} /> : exams.data?.length ? <div className="grid gap-4 md:grid-cols-2">{exams.data.slice(0, 2).map((exam) => <ExamCard key={exam.id} exam={exam} compact />)}</div> : <EmptyState icon={BookOpen} title="No exams in this workspace" copy="Your teacher's published exams will show here when they are ready." />}</section>
    </>}
  </div>;
}

function ExamCard({ exam, compact = false }: { exam: any; compact?: boolean }) {
  return <article className={`group rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] ${compact ? '' : 'animate-rise'}`} data-testid={`card-exam-${exam.id}`}><div className="flex items-start justify-between gap-3"><span className="rounded-md bg-[hsl(var(--secondary))] px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--primary))]">{exam.subject}</span><span className={`rounded-md px-2 py-1 font-mono text-[10px] uppercase ${exam.status === 'Published' ? 'bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`}>{exam.status}</span></div><h3 className="mt-5 font-display text-lg font-extrabold tracking-[-.03em]">{exam.title}</h3><div className="mt-5 flex flex-wrap items-center gap-4 text-xs font-semibold text-[hsl(var(--muted-foreground))]"><span className="inline-flex items-center gap-1.5"><FileQuestion size={14} /> {exam.questionCount} questions</span><span className="inline-flex items-center gap-1.5"><Clock3 size={14} /> {exam.durationMinutes} min</span><span className="inline-flex items-center gap-1.5"><Users size={14} /> {exam.attempts} attempts</span></div>{!compact && <div className="mt-5 border-t border-[hsl(var(--border))] pt-4 text-xs font-bold text-[hsl(var(--primary))]">Exam details <ArrowRight className="ml-1 inline" size={14} /></div>}</article>;
}

function Exams() {
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('');
  const [showForm, setShowForm] = useState(false);
  const data = useGetExams({ search: search || undefined, subject: subject || undefined });
  const create = useCreateExam();
  const qc = useQueryClient();
  const [notice, setNotice] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    create.mutate({ data: { title: String(form.get('title')), subject: String(form.get('subject')), durationMinutes: Number(form.get('durationMinutes')), price: Number(form.get('price') || 0) } }, { onSuccess: () => { setShowForm(false); setNotice('Exam draft created.'); qc.invalidateQueries({ queryKey: getGetExamsQueryKey() }); } });
  }
  return <div className="animate-rise"><PageIntro eyebrow="Exam studio" title="Practice with a plan." copy="Browse shared assessments or create a clear, measured exam for your class." action={<Button onClick={() => setShowForm(true)} data-testid="button-create-exam"><Plus size={17} /> Create exam</Button>} />{notice && <div className="mb-5 flex items-center gap-2 rounded-xl bg-[hsl(var(--primary)/.1)] px-4 py-3 text-sm font-semibold text-[hsl(var(--primary))]" role="status" data-testid="status-exam-created"><Check size={16} /> {notice}</div>}<div className="mb-6 flex flex-col gap-3 rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-4 shadow-[var(--shadow-sm)] sm:flex-row"><label className="relative flex-1"><Search className="absolute left-3 top-3 text-[hsl(var(--muted-foreground))]" size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search exams by title…" className="h-11 w-full rounded-lg bg-[hsl(var(--muted)/.65)] pl-10 pr-3 text-sm outline-none ring-0 focus:bg-[hsl(var(--secondary))]" data-testid="input-search-exams" /></label><div className="relative"><Filter className="absolute left-3 top-3 text-[hsl(var(--muted-foreground))]" size={16} /><input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Filter subject" className="h-11 w-full rounded-lg bg-[hsl(var(--muted)/.65)] pl-9 pr-3 text-sm outline-none sm:w-44" data-testid="input-filter-exams" /></div></div>{data.isLoading ? <LoadingRows count={4} /> : data.isError ? <ErrorState onRetry={() => data.refetch()} /> : data.data?.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.data.map((exam) => <ExamCard key={exam.id} exam={exam} />)}</div> : <EmptyState icon={BookOpen} title="No matching exams" copy="Try a broader search, or create the first exam for this workspace." action={<Button onClick={() => setShowForm(true)} data-testid="button-empty-create-exam"><Plus size={16} /> Create exam</Button>} />}{showForm && <Modal title="Create an exam" onClose={() => setShowForm(false)}><form className="grid gap-4" onSubmit={submit}><Input label="Exam title" name="title" placeholder="e.g. SS2 Biology · Cell division" required minLength={3} data-testid="input-exam-title" /><Input label="Subject" name="subject" placeholder="Biology" required data-testid="input-exam-subject" /><div className="grid grid-cols-2 gap-3"><Input label="Duration (minutes)" name="durationMinutes" type="number" min={1} defaultValue={45} required data-testid="input-exam-duration" /><Input label="Price (₦, optional)" name="price" type="number" min={0} defaultValue={0} data-testid="input-exam-price" /></div>{create.isError && <p className="text-sm text-[hsl(var(--destructive))]">The exam could not be created. Check the fields and try again.</p>}<Button type="submit" disabled={create.isPending} data-testid="button-submit-exam">{create.isPending ? 'Creating…' : 'Create draft'} <ArrowRight size={16} /></Button></form></Modal>}</div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[hsl(var(--sidebar)/.6)] p-4" role="dialog" aria-modal="true" aria-label={title}><div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-[var(--shadow-md)] animate-rise"><div className="mb-6 flex items-start justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary))]">Workspace action</p><h2 className="mt-1 font-display text-xl font-extrabold">{title}</h2></div><button onClick={onClose} className="rounded-lg p-2 hover:bg-[hsl(var(--muted))]" aria-label="Close dialog" data-testid="button-close-dialog"><X size={18} /></button></div>{children}</div></div>;
}

function Questions() {
  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [tab, setTab] = useState<'bank' | 'public'>('bank');
  const [showForm, setShowForm] = useState(false);
  const questions = useGetQuestions({ search: search || undefined, difficulty: difficulty ? difficulty as any : undefined, limit: 50 });
  const publicQuestions = useGetPublicQuestions({ amount: 12 });
  const create = useCreateQuestion();
  const qc = useQueryClient();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    create.mutate({ data: { prompt: String(form.get('prompt')), subject: String(form.get('subject')), type: String(form.get('type')) as any, difficulty: String(form.get('difficulty')) as any, source: String(form.get('source') || '') } }, { onSuccess: () => { setShowForm(false); qc.invalidateQueries({ queryKey: getGetQuestionsQueryKey() }); } });
  }
  return (
    <div className="animate-rise">
      <PageIntro eyebrow="Question bank" title="Find the right prompt." copy="Search your trusted bank, or explore public trivia as a safe starting point for a classroom activity." action={<Button onClick={() => setShowForm(true)} data-testid="button-create-question"><Plus size={17} /> Add question</Button>} />
      <div className="mb-6 flex items-center gap-1 border-b border-[hsl(var(--border))]">
        <button onClick={() => setTab('bank')} className={`border-b-2 px-3 py-3 text-sm font-bold ${tab === 'bank' ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]' : 'border-transparent text-[hsl(var(--muted-foreground))]'}`} data-testid="tab-question-bank">Workspace bank</button>
        <button onClick={() => setTab('public')} className={`border-b-2 px-3 py-3 text-sm font-bold ${tab === 'public' ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]' : 'border-transparent text-[hsl(var(--muted-foreground))]'}`} data-testid="tab-public-questions">Public discovery</button>
      </div>
      {tab === 'bank' ? (
        <>
          <div className="mb-6 flex flex-col gap-3 sm:flex-row">
            <label className="relative flex-1"><Search className="absolute left-3 top-3 text-[hsl(var(--muted-foreground))]" size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search question text…" className="h-11 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] pl-10 pr-3 text-sm outline-none focus:border-[hsl(var(--primary))]" data-testid="input-search-questions" /></label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="h-11 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm outline-none sm:w-44" data-testid="select-question-difficulty"><option value="">All difficulty</option><option value="Easy">Easy</option><option value="Medium">Medium</option><option value="Hard">Hard</option></select>
          </div>
          {questions.isLoading ? <LoadingRows count={5} /> : questions.isError ? <ErrorState onRetry={() => questions.refetch()} /> : questions.data?.length ? (
            <div className="overflow-hidden rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] shadow-[var(--shadow-sm)]">
              <div className="hidden grid-cols-[1fr_130px_100px_90px] gap-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/.55)] px-5 py-3 font-mono text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))] sm:grid"><span>Question</span><span>Subject</span><span>Level</span><span>Used</span></div>
              {questions.data.map((question) => <div key={question.id} className="grid gap-2 border-b border-[hsl(var(--border))] px-5 py-4 last:border-0 sm:grid-cols-[1fr_130px_100px_90px] sm:items-center sm:gap-4" data-testid={`row-question-${question.id}`}><div><p className="text-sm font-semibold leading-5">{question.prompt}</p><p className="mt-1 font-mono text-[10px] text-[hsl(var(--muted-foreground))]">{question.type} {question.source ? `· ${question.source}` : ''}</p></div><span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">{question.subject}</span><span className={`w-fit rounded px-2 py-1 font-mono text-[10px] ${question.difficulty === 'Hard' ? 'bg-[hsl(var(--destructive)/.1)] text-[hsl(var(--destructive))]' : 'bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]'}`}>{question.difficulty}</span><span className="font-mono text-xs text-[hsl(var(--muted-foreground))]">{question.usageCount}×</span></div>)}
            </div>
          ) : <EmptyState icon={FileQuestion} title="Your bank is quiet" copy="Add a question manually or generate a reviewed draft in the AI workspace." action={<Button onClick={() => setShowForm(true)} data-testid="button-empty-add-question"><Plus size={16} /> Add question</Button>} />}
        </>
      ) : <PublicDiscovery data={publicQuestions} />}
      {showForm && <Modal title="Add a trusted question" onClose={() => setShowForm(false)}><form className="grid gap-4" onSubmit={submit}><label className="grid gap-2 text-sm font-semibold">Question prompt<textarea name="prompt" required minLength={5} rows={4} className="resize-y rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] p-3 text-sm outline-none focus:border-[hsl(var(--primary))]" placeholder="Write the question clearly…" data-testid="textarea-question-prompt" /></label><div className="grid grid-cols-2 gap-3"><Input label="Subject" name="subject" required placeholder="Chemistry" data-testid="input-question-subject" /><label className="grid gap-2 text-sm font-semibold">Type<select name="type" className="h-11 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm" data-testid="select-question-type"><option>Multiple Choice</option><option>True/False</option><option>Theory</option></select></label></div><div className="grid grid-cols-2 gap-3"><label className="grid gap-2 text-sm font-semibold">Difficulty<select name="difficulty" className="h-11 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm" data-testid="select-question-form-difficulty"><option>Easy</option><option>Medium</option><option>Hard</option></select></label><Input label="Source (optional)" name="source" placeholder="WAEC 2022" data-testid="input-question-source" /></div>{create.isError && <p className="text-sm text-[hsl(var(--destructive))]">Could not add this question.</p>}<Button type="submit" disabled={create.isPending} data-testid="button-submit-question">{create.isPending ? 'Saving…' : 'Save question'} <Check size={16} /></Button></form></Modal>}
    </div>
  );
}

function PublicDiscovery({ data }: { data: any }) {
  if (data.isLoading) return <LoadingRows count={4} />;
  if (data.isError) return <ErrorState onRetry={() => data.refetch()} />;
  if (!data.data?.length) return <EmptyState icon={Globe2} title="No public questions found" copy="The public discovery feed is empty right now. Return later or use your workspace bank." />;
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.data.map((q: any) => <article key={q.id} className="rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-sm)]"><div className="flex items-center justify-between gap-3"><span className="font-mono text-[10px] uppercase tracking-[.15em] text-[hsl(var(--primary))]">{q.category}</span><span className="rounded bg-[hsl(var(--secondary))] px-2 py-1 font-mono text-[10px]">{q.difficulty}</span></div><h3 className="mt-5 font-display font-bold leading-6">{q.prompt}</h3><ul className="mt-4 grid gap-2">{q.options.map((option: string) => <li key={option} className="rounded-lg bg-[hsl(var(--muted)/.65)] px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">{option}</li>)}</ul><details className="mt-4 border-t border-[hsl(var(--border))] pt-3 text-xs"><summary className="cursor-pointer font-bold text-[hsl(var(--primary))]">Reveal answer</summary><p className="mt-2 font-semibold">{q.answer}</p></details></article>)}</div>;
}

function AIWorkspace() {
  const [prompt, setPrompt] = useState('');
  const [subject, setSubject] = useState('General');
  const [tutorResponse, setTutorResponse] = useState<any>(null);
  const [gen, setGen] = useState<any[]>([]);
  const tutor = useAskTutor();
  const generate = useGenerateQuestions();
  function ask(event: FormEvent) { event.preventDefault(); tutor.mutate({ data: { prompt, subject, level: 'secondary school' } }, { onSuccess: setTutorResponse }); }
  function generateDrafts(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); generate.mutate({ data: { subject: String(form.get('subject')), topic: String(form.get('topic')), count: Number(form.get('count')), difficulty: String(form.get('difficulty')) } }, { onSuccess: setGen }); }
  return <div className="animate-rise"><PageIntro eyebrow="AI workspace" title="A second set of eyes." copy="Ask for a clear explanation or generate drafts for review. XADON keeps AI helpful, visible, and firmly inside a teacher-led workflow." /><div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]"><section className="rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-6 shadow-[var(--shadow-sm)] sm:p-7"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]"><Bot size={20} /></span><div><h2 className="font-display text-xl font-extrabold">Ask the tutor</h2><p className="text-xs text-[hsl(var(--muted-foreground))]">Answers include their review trail.</p></div></div><form onSubmit={ask} className="mt-6 grid gap-4"><label className="grid gap-2 text-sm font-semibold">What are you working through?<textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={5} required minLength={2} className="resize-y rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] p-4 text-sm outline-none focus:border-[hsl(var(--primary))]" placeholder="Explain photosynthesis in a way I can remember…" data-testid="textarea-tutor-prompt" /></label><div className="flex flex-col gap-3 sm:flex-row"><Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} data-testid="input-tutor-subject" /><Button type="submit" disabled={tutor.isPending || !prompt.trim()} className="self-end" data-testid="button-ask-tutor"><Send size={16} /> {tutor.isPending ? 'Thinking…' : 'Ask tutor'}</Button></div></form>{tutor.isError && <p className="mt-4 text-sm text-[hsl(var(--destructive))]">The tutor is unavailable right now. Please try again.</p>}{tutorResponse && <div className="mt-6 rounded-xl border border-[hsl(var(--primary)/.2)] bg-[hsl(var(--primary)/.06)] p-5" data-testid="panel-tutor-response"><div className="flex items-center justify-between"><span className="font-mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">Reviewed response</span><span className="rounded bg-[hsl(var(--primary)/.12)] px-2 py-1 font-mono text-[10px]">{tutorResponse.mode}</span></div><p className="mt-4 whitespace-pre-wrap text-sm leading-7">{tutorResponse.answer}</p>{tutorResponse.sources?.length > 0 && <div className="mt-5 border-t border-[hsl(var(--primary)/.15)] pt-4"><p className="font-mono text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Sources</p><ul className="mt-2 grid gap-1 text-xs text-[hsl(var(--muted-foreground))]">{tutorResponse.sources.map((source: string) => <li key={source}>↳ {source}</li>)}</ul></div>}</div>}</section><section className="rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-6 shadow-[var(--shadow-sm)] sm:p-7"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[hsl(var(--accent)/.18)] text-[hsl(25_67%_39%)]"><Sparkles size={20} /></span><div><h2 className="font-display text-xl font-extrabold">Generate drafts</h2><p className="text-xs text-[hsl(var(--muted-foreground))]">Every draft needs human review.</p></div></div><form onSubmit={generateDrafts} className="mt-6 grid gap-4"><Input label="Subject" name="subject" placeholder="Mathematics" required data-testid="input-generate-subject" /><Input label="Topic" name="topic" placeholder="Quadratic equations" required data-testid="input-generate-topic" /><div className="grid grid-cols-2 gap-3"><Input label="Draft count" name="count" type="number" min={1} max={20} defaultValue={3} required data-testid="input-generate-count" /><label className="grid gap-2 text-sm font-semibold">Difficulty<select name="difficulty" className="h-11 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm" data-testid="select-generate-difficulty"><option>Medium</option><option>Easy</option><option>Hard</option></select></label></div><Button type="submit" disabled={generate.isPending} variant="quiet" data-testid="button-generate-questions"><Lightbulb size={16} /> {generate.isPending ? 'Generating…' : 'Generate reviewed drafts'}</Button></form>{generate.isError && <p className="mt-4 text-sm text-[hsl(var(--destructive))]">Draft generation failed. Try adjusting the topic.</p>}</section></div>{gen.length > 0 && <section className="mt-6 rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-6 shadow-[var(--shadow-sm)]" data-testid="panel-generated-questions"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">Review queue</p><h2 className="mt-1 font-display text-xl font-extrabold">Drafts ready for a teacher</h2></div><span className="font-mono text-xs text-[hsl(var(--muted-foreground))]">{gen.length} generated</span></div><div className="mt-5 grid gap-4 md:grid-cols-2">{gen.map((q, i) => <article key={`${q.prompt}-${i}`} className="rounded-xl border border-[hsl(var(--border))] p-4"><span className="font-mono text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Draft {String(i + 1).padStart(2, '0')}</span><h3 className="mt-3 text-sm font-bold leading-6">{q.prompt}</h3><p className="mt-3 rounded-lg bg-[hsl(var(--muted)/.7)] p-3 text-xs"><strong>Answer:</strong> {q.answer}</p><p className="mt-3 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{q.explanation}</p>{q.distractors?.length > 0 && <p className="mt-3 font-mono text-[10px] text-[hsl(var(--muted-foreground))]">Distractors: {q.distractors.join(' · ')}</p>}</article>)}</div></section>}</div>;
}

function Security() {
  const [keyword, setKeyword] = useState('');
  const [url, setUrl] = useState('');
  const cves = useGetSecurityCves({ keyword: keyword || undefined, limit: 10 });
  const headers = useCheckSecurityHeaders();
  const [result, setResult] = useState<any>(null);
  function check(event: FormEvent) { event.preventDefault(); headers.mutate({ data: { url } }, { onSuccess: setResult }); }
  return <div className="animate-rise"><PageIntro eyebrow="Defensive security lab" title="See the risk. Reduce it." copy="A quiet, practical toolkit for understanding known vulnerabilities and strengthening the headers on sites you own." action={<span className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--primary)/.25)] bg-[hsl(var(--primary)/.06)] px-3 py-2 text-xs font-bold text-[hsl(var(--primary))]"><LockKeyhole size={14} /> Read-only by design</span>} /><div className="grid gap-6 xl:grid-cols-[.9fr_1.1fr]"><section className="rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-6 shadow-[var(--shadow-sm)]"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[hsl(var(--destructive)/.1)] text-[hsl(var(--destructive))]"><ShieldAlert size={20} /></span><div><h2 className="font-display text-xl font-extrabold">CVE watchlist</h2><p className="text-xs text-[hsl(var(--muted-foreground))]">Understand, don’t exploit.</p></div></div><div className="mt-6 flex gap-2"><input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Search advisories…" className="h-11 min-w-0 flex-1 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm outline-none focus:border-[hsl(var(--primary))]" data-testid="input-search-cves" /><Button onClick={() => cves.refetch()} variant="quiet" aria-label="Refresh advisories" data-testid="button-refresh-cves"><RefreshCw size={16} /></Button></div><div className="mt-5 grid gap-3">{cves.isLoading ? <LoadingRows count={3} /> : cves.isError ? <ErrorState onRetry={() => cves.refetch()} /> : cves.data?.length ? cves.data.map((item) => <article key={item.id} className="rounded-xl border border-[hsl(var(--border))] p-4" data-testid={`card-advisory-${item.id}`}><div className="flex items-start justify-between gap-3"><span className="font-mono text-[10px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{item.id}</span><span className={`rounded px-2 py-1 font-mono text-[10px] ${String(item.severity).toLowerCase().includes('critical') || String(item.severity).toLowerCase().includes('high') ? 'bg-[hsl(var(--destructive)/.1)] text-[hsl(var(--destructive))]' : 'bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]'}`}>{item.severity}</span></div><h3 className="mt-3 text-sm font-bold leading-5">{item.summary}</h3><p className="mt-3 font-mono text-[10px] text-[hsl(var(--muted-foreground))]">Published {item.published}</p></article>) : <EmptyState icon={ShieldCheck} title="No advisories match" copy="Try a product, vendor, or CVE keyword." />}</div></section><section className="rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-6 shadow-[var(--shadow-sm)]"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[hsl(var(--accent)/.18)] text-[hsl(25_67%_39%)]"><Globe2 size={20} /></span><div><h2 className="font-display text-xl font-extrabold">Header health check</h2><p className="text-xs text-[hsl(var(--muted-foreground))]">Check a site you’re responsible for.</p></div></div><form onSubmit={check} className="mt-6 flex flex-col gap-3 sm:flex-row"><input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-school-site.ng" className="h-11 min-w-0 flex-1 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm outline-none focus:border-[hsl(var(--primary))]" data-testid="input-security-url" /><Button type="submit" disabled={headers.isPending} data-testid="button-check-headers">{headers.isPending ? 'Checking…' : 'Run check'} <ArrowRight size={16} /></Button></form><p className="mt-3 flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]"><LockKeyhole size={13} /> Only use this on domains you own or have permission to assess.</p>{headers.isError && <p className="mt-5 text-sm text-[hsl(var(--destructive))]">The header check could not complete. Verify the URL and try again.</p>}{result && <div className="mt-7 rounded-xl border border-[hsl(var(--border))] p-5" data-testid="panel-header-result"><div className="flex items-center gap-5"><div className="grid size-20 place-items-center rounded-full border-[6px] border-[hsl(var(--primary)/.16)] font-display text-2xl font-extrabold text-[hsl(var(--primary))]">{result.score}</div><div><p className="font-mono text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Header score</p><p className="mt-1 text-sm font-bold break-all">{result.url}</p></div></div><div className="mt-6 grid gap-2">{result.checks?.map((item: any) => <div key={item.name} className="flex items-start gap-3 rounded-lg bg-[hsl(var(--muted)/.65)] p-3"><span className={`mt-0.5 grid size-5 place-items-center rounded-full ${item.present ? 'bg-[hsl(var(--primary)/.14)] text-[hsl(var(--primary))]' : 'bg-[hsl(var(--destructive)/.12)] text-[hsl(var(--destructive))]'}`}>{item.present ? <Check size={13} /> : <X size={13} />}</span><div><p className="text-xs font-bold">{item.name}</p><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{item.recommendation}</p></div></div>)}</div><p className="mt-4 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{result.note}</p></div>}</section></div></div>;
}

function Settings() {
  const user = useGetCurrentUser({ query: { retry: false, queryKey: getGetCurrentUserQueryKey() } });
  const [saved, setSaved] = useState(false);
  return <div className="animate-rise max-w-4xl"><PageIntro eyebrow="Workspace preferences" title="Make it yours." copy="Your identity and workspace controls, kept simple and visible." /><div className="grid gap-6"><section className="rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-6 shadow-[var(--shadow-sm)]"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]"><SettingsIcon size={20} /></span><div><h2 className="font-display text-xl font-extrabold">Profile</h2><p className="text-xs text-[hsl(var(--muted-foreground))]">Your current authenticated identity.</p></div></div>{user.isLoading ? <div className="mt-6"><LoadingRows count={2} /></div> : user.data ? <div className="mt-6 grid gap-4 sm:grid-cols-2"><Input label="Name" value={user.data.name} readOnly data-testid="input-settings-name" /><Input label="Email" value={user.data.email} readOnly data-testid="input-settings-email" /><div className="rounded-lg bg-[hsl(var(--muted)/.65)] p-3 text-sm"><p className="font-mono text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Role</p><p className="mt-2 font-bold">{user.data.role}</p></div><div className="rounded-lg bg-[hsl(var(--muted)/.65)] p-3 text-sm"><p className="font-mono text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Streak</p><p className="mt-2 font-bold">{user.data.streak ?? 0} days</p></div></div> : <ErrorState onRetry={() => user.refetch()} />}</section><section className="rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-6 shadow-[var(--shadow-sm)]"><div className="flex items-start justify-between gap-4"><div><h2 className="font-display text-xl font-extrabold">Learning defaults</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">A few choices for a more useful command center.</p></div><span className="rounded bg-[hsl(var(--secondary))] px-2 py-1 font-mono text-[10px]">LOCAL</span></div><div className="mt-6 grid gap-3"><label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-[hsl(var(--border))] p-4"><span><span className="block text-sm font-bold">Reviewed content first</span><span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">Prefer teacher-reviewed questions in discovery.</span></span><input type="checkbox" defaultChecked className="size-4 accent-[hsl(var(--primary))]" data-testid="checkbox-reviewed-content" /></label><label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-[hsl(var(--border))] p-4"><span><span className="block text-sm font-bold">Study reminders</span><span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">Keep a gentle nudge for your daily streak.</span></span><input type="checkbox" defaultChecked className="size-4 accent-[hsl(var(--primary))]" data-testid="checkbox-study-reminders" /></label></div><div className="mt-5 flex items-center gap-3"><Button onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2800); }} data-testid="button-save-settings">{saved ? <><Check size={16} /> Saved</> : 'Save preferences'}</Button>{saved && <span className="text-xs font-semibold text-[hsl(var(--primary))]" role="status" data-testid="status-settings-saved">Preferences saved on this device.</span>}</div></section></div></div>;
}

function AuthLayout({ children, mode }: { children: ReactNode; mode: 'login' | 'signup' }) {
  return <div className="noise grid min-h-[100dvh] bg-[hsl(var(--background))] lg:grid-cols-[.88fr_1.12fr]"><div className="relative hidden overflow-hidden bg-[hsl(var(--sidebar))] p-10 text-[hsl(var(--sidebar-foreground))] lg:block"><Logo /><div className="absolute -right-32 -top-20 size-[500px] rounded-full border-[50px] border-[hsl(var(--sidebar-primary)/.08)]" /><div className="absolute bottom-12 left-10 right-10"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--sidebar-primary))]">A clearer way to prepare</p><h1 className="mt-4 max-w-md font-display text-5xl font-extrabold leading-[1.02] tracking-[-.07em]">Learning that holds its shape.</h1><p className="mt-6 max-w-sm text-sm leading-7 text-[hsl(var(--sidebar-foreground)/.68)]">XADON brings practice, trusted content, and defensive digital confidence into one calm workspace for Nigeria’s next generation.</p><div className="mt-10 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[.14em] text-[hsl(var(--sidebar-foreground)/.55)]"><span className="size-2 rounded-full bg-[hsl(var(--sidebar-primary))]" /> Secure by default</div></div></div><main className="flex flex-col p-6 sm:p-10"><div className="flex items-center justify-between lg:justify-end"><div className="lg:hidden"><Logo /></div><span className="font-mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">{mode === 'login' ? 'New to XADON?' : 'Already have an account?'}</span><Link href={mode === 'login' ? '/signup' : '/login'} className="ml-3 text-sm font-bold text-[hsl(var(--primary))]" data-testid={`link-auth-${mode === 'login' ? 'signup' : 'login'}`}>{mode === 'login' ? 'Create account' : 'Sign in'}</Link></div><div className="mx-auto flex w-full max-w-md flex-1 items-center py-12">{children}</div></main></div>;
}

function Login() {
  return <div className="noise flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] px-4 py-10"><ClerkSignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div>;
}

function Signup() {
  return <div className="noise flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] px-4 py-10"><ClerkSignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div>;
}

function PrivateRouter() {
  return <Shell><Switch><Route path="/" component={Dashboard} /><Route path="/exams" component={Exams} /><Route path="/questions" component={Questions} /><Route path="/ai" component={AIWorkspace} /><Route path="/security" component={Security} /><Route path="/settings" component={Settings} /><Route component={NotFound} /></Switch></Shell>;
}

function Router() {
  const [location] = useLocation();
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <div className="grid min-h-[100dvh] place-items-center bg-[hsl(var(--background))] text-sm text-[hsl(var(--muted-foreground))]">Loading secure workspace…</div>;
  if (location === '/login' || location.startsWith('/sign-in')) return <Login />;
  if (location === '/signup' || location.startsWith('/sign-up')) return <Signup />;
  if (!isSignedIn) return <Landing />;
  return <PrivateRouter />;
}

function Landing() {
  return <div className="noise min-h-[100dvh] bg-[hsl(var(--background))]"><header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8"><Logo /><div className="flex items-center gap-3"><Link href="/sign-in" className="text-sm font-bold text-[hsl(var(--foreground))]">Sign in</Link><Link href="/sign-up" className="inline-flex min-h-10 items-center rounded-lg bg-[hsl(var(--primary))] px-4 text-sm font-bold text-[hsl(var(--primary-foreground))]">Create account</Link></div></header><main className="mx-auto grid max-w-6xl gap-10 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:pt-24"><div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">Focused learning · safer digital confidence</p><h1 className="mt-5 max-w-3xl font-display text-5xl font-extrabold leading-[.98] tracking-[-.07em] sm:text-7xl">Prepare with clarity, not panic.</h1><p className="mt-6 max-w-xl text-base leading-8 text-[hsl(var(--muted-foreground))]">XADON brings CBT practice, teacher-reviewed questions, a real AI tutor, and read-only defensive security checks into one trusted workspace.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/sign-up" className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-5 text-sm font-bold text-[hsl(var(--primary-foreground))]">Start learning <ArrowRight size={17} /></Link><Link href="/sign-in" className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-5 text-sm font-bold">Open workspace</Link></div><div className="mt-12 flex flex-wrap gap-6 text-xs font-semibold text-[hsl(var(--muted-foreground))]"><span className="inline-flex items-center gap-2"><ShieldCheck size={15} className="text-[hsl(var(--primary))]" /> Managed sign-in</span><span className="inline-flex items-center gap-2"><Bot size={15} className="text-[hsl(var(--primary))]" /> Teacher-led AI</span><span className="inline-flex items-center gap-2"><LockKeyhole size={15} className="text-[hsl(var(--primary))]" /> Ethical by design</span></div></div><div className="surface-grid rounded-3xl bg-[hsl(var(--sidebar))] p-6 text-[hsl(var(--sidebar-foreground))] shadow-[var(--shadow-md)] sm:p-8"><div className="flex items-center justify-between"><span className="font-mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--sidebar-primary))]">XADON / signal</span><span className="inline-flex items-center gap-2 font-mono text-[10px] text-[hsl(var(--sidebar-foreground)/.62)]"><span className="size-2 rounded-full bg-[hsl(var(--sidebar-primary))] animate-pulse-soft" /> LIVE</span></div><div className="mt-12 grid gap-3"><div className="rounded-2xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent)/.7)] p-5"><p className="font-mono text-[10px] uppercase tracking-[.14em] text-[hsl(var(--sidebar-foreground)/.55)]">Today’s direction</p><p className="mt-2 font-display text-2xl font-extrabold">Practice the next clear step.</p></div><div className="grid grid-cols-2 gap-3"><div className="rounded-2xl border border-[hsl(var(--sidebar-border))] p-4"><p className="font-mono text-[10px] text-[hsl(var(--sidebar-foreground)/.55)]">ACCURACY</p><p className="mt-2 font-display text-3xl font-extrabold text-[hsl(var(--sidebar-primary))]">78%</p></div><div className="rounded-2xl border border-[hsl(var(--sidebar-border))] p-4"><p className="font-mono text-[10px] text-[hsl(var(--sidebar-foreground)/.55)]">STREAK</p><p className="mt-2 font-display text-3xl font-extrabold text-[hsl(var(--accent))]">04</p></div></div></div></div></main></div>;
}

function App() {
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to continue your learning trail' } }, signUp: { start: { title: 'Create your XADON account', subtitle: 'Build a focused practice rhythm' } } }}><QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={basePath}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider></ClerkProvider>;
}

export default App;