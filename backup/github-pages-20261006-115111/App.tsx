import { readNexusUsage, type NexusUsage } from "@/lib/nexus-usage";
import AuthPage from "./auth/AuthPage";import { ClerkProvider, SignIn, SignUp, useSignIn } from "@clerk/react";
import { useEffect, useMemo, useState, createContext, useContext, type ReactNode } from 'react';
import { Link, Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { Brain, Activity, AlertTriangle, Bell, Bot, Check, ChevronRight, CircleHelp, CloudOff, Cpu, ExternalLink, Filter, Heart, History, Laptop, Menu, MessageSquare, PackageOpen, Play, Power, RefreshCw, Radio, Send, Server, Settings, ShieldCheck, SlidersHorizontal, Sparkles, Trash2, Wifi, X, Zap } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { chatWithAI, getAIStatus, type AIStatus } from '@/lib/nexus-ai';
import NotFound from '@/pages/not-found';
import { defaultCriteria, listings, matchListings, readData, writeData, type AppData, type Criteria, type Listing } from '@/lib/nexus-storage';
import { askNotificationPermission, initInstallPrompt, registerOffline, testNotification } from '@/lib/nexus-pwa';
import { runNexusAgent } from '@/lib/nexus-agent';
import { runNexusSearch, type NexusSearchResult } from '@/lib/nexus-search';

type Ctx = { data: AppData; setData: (next: AppData) => void; installEvent: Event | null; setInstallEvent: (e: Event | null) => void; offline: boolean };
const AppContext = createContext<Ctx | null>(null);
const usenexus = () => { const value = useContext(AppContext); if (!value) throw new Error('NEXUS context missing'); return value; };
const basePath = import.meta.env.BASE_URL === '/' ? '' : import.meta.env.BASE_URL.replace(/\/$/, '');
const stripBase = (path: string) => basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
function App() {
  const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  if (!clerkPubKey) {
    return (
      <div style={{ padding: 30 }}>
        VITE_CLERK_PUBLISHABLE_KEY manquante.
      </div>
    );
  }

  return (
    <WouterRouter base={basePath}>
        
          <Router />
        
      </WouterRouter>
  );
}
function Router() {
  return <Switch>
    <Route path="/" component={HomeRedirect}/>
    <Route path="/sign-in/*?" component={SignInPage}/>
    <Route path="/reset-password" component={() => <Redirect to="/sign-in" />} />
    <Route path="/console" component={PrivateWorkspace}/>
    <Route path="/chat" component={PrivateWorkspace}/>
    <Route path="/settings" component={PrivateWorkspace}/>
    <Route path="/criteria" component={PrivateWorkspace}/>
    <Route path="/history" component={PrivateWorkspace}/>
    <Route path="/favorites" component={PrivateWorkspace}/>
    <Route path="/notifications" component={PrivateWorkspace}/>
    <Route path="/subscription" component={PrivateWorkspace}/>
    <Route component={NotFound}/>
  </Switch>;
}

function HomeRedirect() {
  return <Redirect to="/console" />;
}

function PrivateWorkspace() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("nexus_session");
      if (!raw) {
        setAuthenticated(false);
        return;
      }

      const session = JSON.parse(raw);

      setAuthenticated(
        session?.role === "owner" &&
        typeof session?.email === "string"
      );
    } catch {
      localStorage.removeItem("nexus_session");
      setAuthenticated(false);
    }
  }, []);

  return (
    <PrivateDataProvider scope="local">
      <Shell />
    </PrivateDataProvider>
  );
}

function PrivateDataProvider({ scope, children }: { scope: string; children: ReactNode }) {
  const [data, setDataState] = useState<AppData>(() => readData(scope));
  const [installEvent, setInstallEvent] = useState<Event | null>(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const setData = (next: AppData) => { setDataState(next); writeData(next, scope); };
  useEffect(() => {
    setDataState(readData(scope));
    registerOffline();
    initInstallPrompt(setInstallEvent);
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [scope]);
  return <AppContext.Provider value={{ data, setData, installEvent, setInstallEvent, offline }}>{children}</AppContext.Provider>;
}

function LoadingScreen() {
  return (
    <div className="nexus-shell grid min-h-[100dvh] place-items-center">
      <div className="panel rounded-2xl px-7 py-6 text-center">
        <div className="code text-[10px] uppercase tracking-[.2em] text-[hsl(var(--cyan))]">
          NEXUS
        </div>
        <p className="mt-2 text-sm text-[hsl(var(--soft))]">
          Chargement…
        </p>
      </div>
    </div>
  );
}

function LandingPage() {
  return <div className="nexus-shell grid min-h-[100dvh] place-items-center px-5 py-10"><div className="w-full max-w-xl text-center fade-up"><div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-[hsl(var(--cyan))] text-[hsl(var(--bg))] shadow-[0_0_34px_hsl(var(--cyan)/.35)]"><Zap size={31} fill="currentColor"/></div><div className="code mb-3 text-[10px] uppercase tracking-[.26em] text-[hsl(var(--cyan))]">NEXUS PC FINDER / PRIVÃ‰</div><h1 className="display text-4xl font-bold tracking-tight sm:text-6xl">Votre console personnelle.</h1><p className="mx-auto mt-5 max-w-md text-base leading-7 text-[hsl(var(--soft))]">Une veille locale pour filtrer et comparer des PC gaming. Vos critères, favoris et historiques restent derrière votre connexion.</p><Link href="/sign-in" className="btn btn-primary mt-8 px-6 py-3" data-testid="button-private-sign-in"><ShieldCheck size={16}/> Accéder Ã  NEXUS</Link><p className="code mt-5 text-[9px] uppercase tracking-widest text-[hsl(var(--soft))]">Accès privé Â· aucune donnée personnelle sur cette page</p></div></div>;
}

function SignInPage() { return <AuthPage />; }


function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const { signIn } = useSignIn();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  const [step, setStep] = useState<"email" | "code" | "password">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const sendCode = async () => {
    if (!signIn) {
      setError("Clerk n'est pas encore chargé.");
      return;
    }

    const address = email.trim().toLowerCase();

    if (!address || !address.includes("@")) {
      setError("Entre une adresse e-mail valide.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const createResult = await signIn.create({
        identifier: address,
      });

      if (createResult.error) {
        setError(
          createResult.error.longMessage ||
          "Ce compte n'a pas pu être trouvé."
        );
        return;
      }

      const sendResult =
        await signIn.resetPasswordEmailCode.sendCode();

      if (sendResult.error) {
        setError(
          sendResult.error.longMessage ||
          "Clerk n'a pas pu envoyer le code."
        );
        return;
      }

      setStep("code");

      setMessage(
        "Code envoyé. Vérifie ta boîte e-mail et tes spams."
      );
    } catch (err: any) {
      setError(
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        "Impossible d'envoyer le code."
      );
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!signIn) return;

    const cleanCode = code.trim();

    if (!cleanCode) {
      setError("Entre le code reçu par e-mail.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const result =
        await signIn.resetPasswordEmailCode.verifyCode({
          code: cleanCode,
        });

      if (result.error) {
        setError(
          result.error.longMessage ||
          "Le code est incorrect ou expiré."
        );
        return;
      }

      setStep("password");

      setMessage(
        "Code vérifié. Tu peux maintenant créer ton nouveau mot de passe."
      );
    } catch (err: any) {
      setError(
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        "Impossible de vérifier le code."
      );
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async () => {
    if (!signIn) return;

    if (password.length < 8) {
      setError(
        "Le nouveau mot de passe doit contenir au moins 8 caractères."
      );
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const result =
        await signIn.resetPasswordEmailCode.submitPassword({
          password,
          signOutOfOtherSessions: true,
        });

      if (result.error) {
        setError(
          result.error.longMessage ||
          "Impossible de modifier le mot de passe."
        );
        return;
      }

      setMessage(
        "Mot de passe NEXUS modifié avec succès."
      );

      setTimeout(() => {
        navigate("/sign-in");
      }, 1500);
    } catch (err: any) {
      setError(
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        "Impossible de modifier le mot de passe."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="nexus-shell grid min-h-[100dvh] place-items-center p-5">
      <div className="panel w-full max-w-md rounded-2xl p-6 sm:p-8">

        <button
          type="button"
          onClick={() => navigate("/sign-in")}
          className="mb-6 text-xs text-[hsl(var(--soft))] hover:text-[hsl(var(--cyan))]"
        >
          ← Retour à la connexion
        </button>

        <div className="code text-[10px] uppercase tracking-[.2em] text-[hsl(var(--cyan))]">
          NEXUS
        </div>

        <h1 className="display mt-2 text-3xl font-bold">
          Réinitialiser le mot de passe
        </h1>

        {step === "email" && (
          <div className="mt-6 space-y-4">

            <p className="text-sm leading-6 text-[hsl(var(--soft))]">
              Entre l'adresse e-mail de ton compte NEXUS.
              Un code unique sera envoyé par e-mail.
            </p>

            <div>
              <label className="label">
                Adresse e-mail
              </label>

              <input
                className="field"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError("");
                }}
                placeholder="ton@email.com"
                autoComplete="email"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="button"
              className="btn btn-primary w-full"
              onClick={sendCode}
              disabled={loading}
            >
              {loading ? "Envoi..." : "Envoyer le code"}
            </button>

          </div>
        )}

        {step === "code" && (
          <div className="mt-6 space-y-4">

            <div className="rounded-lg border border-[hsl(var(--cyan)/.25)] bg-[hsl(var(--cyan)/.05)] p-4">
              <p className="text-sm">
                Un code unique vient d'être envoyé à :
              </p>

              <p className="mt-1 font-semibold">
                {email}
              </p>
            </div>

            <div>
              <label className="label">
                Code de vérification
              </label>

              <input
                className="field text-center text-lg tracking-[.5em]"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(event) => {
                  setCode(
                    event.target.value.replace(/\D/g, "")
                  );
                  setError("");
                }}
                placeholder="000000"
                autoComplete="one-time-code"
              />
            </div>

            {message && (
              <div className="text-sm text-[hsl(var(--cyan))]">
                {message}
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="button"
              className="btn btn-primary w-full"
              onClick={verifyCode}
              disabled={loading}
            >
              {loading ? "Vérification..." : "Vérifier le code"}
            </button>

            <button
              type="button"
              className="w-full text-xs text-[hsl(var(--soft))] hover:text-[hsl(var(--cyan))]"
              onClick={() => {
                setStep("email");
                setCode("");
                setError("");
                setMessage("");
              }}
            >
              Renvoyer / changer d'adresse
            </button>

          </div>
        )}

        {step === "password" && (
          <div className="mt-6 space-y-4">

            <p className="text-sm leading-6 text-[hsl(var(--soft))]">
              Ton code est validé. Choisis maintenant ton nouveau
              mot de passe NEXUS.
            </p>

            <div>
              <label className="label">
                Nouveau mot de passe
              </label>

              <input
                className="field"
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                }}
                placeholder="Nouveau mot de passe"
                autoComplete="new-password"
              />
            </div>

            {message && (
              <div className="text-sm text-[hsl(var(--cyan))]">
                {message}
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="button"
              className="btn btn-primary w-full"
              onClick={changePassword}
              disabled={loading}
            >
              {loading
                ? "Modification..."
                : "Modifier le mot de passe"}
            </button>

          </div>
        )}

      </div>
    </div>
  );
}
function Shell() {
  const [location] = useLocation(); const [mobileOpen, setMobileOpen] = useState(false); const { data, offline } = usenexus(); 
  const nav = [{ href: '/console', label: 'Console', icon: Activity }, { href: '/chat', label: 'NEXUS Chat', icon: MessageSquare }, { href: '/criteria', label: 'Critères', icon: SlidersHorizontal }, { href: '/history', label: 'Historique', icon: History }, { href: '/favorites', label: 'Favoris', icon: Heart }, { href: '/notifications', label: 'Alertes', icon: Bell }];
  return <div className="nexus-shell">
    <header className="sticky top-0 z-20 border-b border-[hsl(var(--line))] bg-[hsl(var(--bg)/.88)] backdrop-blur-md">
       <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3"><button className="btn btn-quiet p-2 md:hidden" aria-label="Ouvrir le menu" data-testid="button-open-menu" onClick={() => setMobileOpen(!mobileOpen)}><Menu size={19}/></button><Link href="/" className="flex items-center gap-3" data-testid="link-logo"><div className="grid h-9 w-9 place-items-center rounded-lg bg-[hsl(var(--cyan))] text-[hsl(var(--bg))] shadow-[0_0_22px_hsl(var(--cyan)/.3)]"><Zap size={19} fill="currentColor"/></div><div><div className="display text-base font-bold tracking-wide">NEXUS</div><div className="code text-[9px] uppercase tracking-[.2em] text-[hsl(var(--soft))]">PC FINDER / DEMO</div></div></Link></div>
         <div className="flex items-center gap-2 sm:gap-3"><div className="hidden max-w-[170px] truncate text-right text-[10px] text-[hsl(var(--soft))] sm:block" title="NEXUS">NEXUS</div><div className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider sm:flex ${offline ? 'border-[hsl(var(--amber)/.4)] text-[hsl(var(--amber))]' : 'border-[hsl(var(--lime)/.35)] text-[hsl(var(--lime))]'}`} data-testid="status-connectivity">{offline ? <CloudOff size={13}/> : <Wifi size={13}/>} {offline ? 'Hors ligne' : 'Offline ready'}</div><Link className="btn btn-quiet p-2" href="/notifications" aria-label="Notifications" data-testid="link-notifications"><Bell size={18}/><span className="sr-only">Notifications</span></Link><Link className="btn btn-quiet p-2" href="/settings" aria-label="Paramètres Nexus" data-testid="link-settings"><Settings size={18}/></Link><Link className="btn btn-quiet p-2" href="/" aria-label="Retour à l'accueil" data-testid="button-home"><Power size={18}/></Link></div>
      </div>
    </header>
    <div className="mx-auto flex max-w-[1500px]">
      <aside className={`${mobileOpen ? 'block' : 'hidden'} fixed inset-x-3 top-[72px] z-10 rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--panel))] p-3 md:static md:block md:w-60 md:shrink-0 md:border-0 md:bg-transparent md:p-6 md:pr-3`}>
        <div className="mb-5 hidden items-center justify-between px-2 md:flex"><span className="code text-[10px] uppercase tracking-[.18em] text-[hsl(var(--soft))]">Navigation</span><span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--lime))]"/></div>
        <nav className="space-y-1">{nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={`nav-link flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold ${location === href ? 'bg-[hsl(var(--cyan)/.1)] text-[hsl(var(--cyan))]' : 'text-[hsl(var(--soft))] hover:bg-[hsl(var(--panel))] hover:text-[hsl(var(--text))]'}`} data-testid={`link-nav-${label.toLowerCase()}`}><Icon size={17}/>{label}{label === 'Favoris' && data.favorites.length > 0 ? <span className="ml-auto rounded-full bg-[hsl(var(--cyan)/.15)] px-2 py-0.5 text-[10px] text-[hsl(var(--cyan))]">{data.favorites.length}</span> : null}</Link>)}</nav>
        <Link href="/subscription" onClick={() => setMobileOpen(false)} className="mt-5 flex items-center gap-3 rounded-xl border border-[hsl(var(--cyan)/.25)] bg-[hsl(var(--cyan)/.06)] px-3 py-3 text-sm font-semibold text-[hsl(var(--cyan))] hover:bg-[hsl(var(--cyan)/.1)]">
          <Sparkles size={17}/>
          <span>
            <span className="block">NEXUS Plus / Pro</span>
            <span className="mt-0.5 block text-[10px] font-normal text-[hsl(var(--soft))]">Voir les abonnements</span>
          </span>
        </Link>
        <div className="mt-8 rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--panel)/.6)] p-4"><div className="mb-2 flex items-center gap-2 text-[hsl(var(--cyan))]"><ShieldCheck size={15}/><span className="code text-[10px] uppercase tracking-wider">Mode démo</span></div><p className="text-xs leading-5 text-[hsl(var(--soft))]">Les annonces affichées sont fictives. Aucune source externe n'est interrogée.</p></div>
      </aside>
        <main className="min-w-0 flex-1 px-4 pb-16 pt-6 sm:px-6 md:pt-8"><Switch><Route path="/console" component={Dashboard}/><Route path="/settings" component={SettingsPage}/><Route path="/chat" component={ChatPage}/><Route path="/criteria" component={CriteriaPage}/><Route path="/history" component={HistoryPage}/><Route path="/favorites" component={FavoritesPage}/><Route path="/notifications" component={NotificationsPage}/><Route path="/subscription" component={SubscriptionPage}/><Route component={NotFound}/></Switch></main>
    </div>
  </div>;
}

function PageTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) { return <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end fade-up"><div><div className="code mb-2 text-[10px] uppercase tracking-[.2em] text-[hsl(var(--cyan))]">{eyebrow}</div><h1 className="display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1></div>{children}</div>; }
function StatusBar({ active }: { active: boolean }) { const { offline } = usenexus(); return <div className="panel mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3"><div className="flex items-center gap-3"><div className="relative"><span className={`block h-2.5 w-2.5 rounded-full ${active ? 'bg-[hsl(var(--lime))]' : 'bg-[hsl(var(--soft))]'}`}/>{active && <span className="pulse-ring absolute -inset-1 rounded-full"/>}</div><span className={`code text-[11px] uppercase tracking-wider ${active ? 'text-[hsl(var(--lime))]' : 'text-[hsl(var(--soft))]'}`}>NEXUS {active ? 'actif' : 'en pause'}</span><span className="hidden text-xs text-[hsl(var(--soft))] sm:inline">{active ? 'Moteur local prêt Ã  recevoir une consigne' : 'La veille est suspendue jusquâ€™Ã  votre prochaine action'}</span></div><div className="code text-[10px] uppercase tracking-widest text-[hsl(var(--soft))]">{offline ? 'Cache local / hors ligne' : 'Données locales / démo'}</div></div>; }

function SettingsPage() {
  const [groqKey, setGroqKey] = useState('');
  const [tavilyKey, setTavilyKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      setGroqKey(localStorage.getItem('nexus_groq_api_key') || '');
      setTavilyKey(localStorage.getItem('nexus_tavily_api_key') || '');
      setOpenaiKey(localStorage.getItem('nexus_openai_api_key') || '');
      setAnthropicKey(localStorage.getItem('nexus_anthropic_api_key') || '');
    } catch {}
  }, []);

  const saveKeys = () => {
    try {
      localStorage.setItem('nexus_groq_api_key', groqKey.trim());
      localStorage.setItem('nexus_tavily_api_key', tavilyKey.trim());
      localStorage.setItem('nexus_openai_api_key', openaiKey.trim());
      localStorage.setItem('nexus_anthropic_api_key', anthropicKey.trim());

      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch {}
  };

  const clearKeys = () => {
    setGroqKey('');
    setTavilyKey('');
    setOpenaiKey('');
    setAnthropicKey('');

    try {
      localStorage.removeItem('nexus_groq_api_key');
      localStorage.removeItem('nexus_tavily_api_key');
      localStorage.removeItem('nexus_openai_api_key');
      localStorage.removeItem('nexus_anthropic_api_key');
    } catch {}
  };

  return (
    <div className="mx-auto max-w-[1100px]">

      <PageTitle
        eyebrow="Configuration / NEXUS"
        title="Paramètres"
      >
        <Link href="/console" className="btn btn-primary">
          <Activity size={16}/>
          Retour à la console
        </Link>
      </PageTitle>

      <div className="space-y-5">

        <section className="panel rounded-xl p-5 sm:p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-[hsl(var(--cyan)/.12)] text-[hsl(var(--cyan))]">
              <Settings size={18}/>
            </div>

            <div>
              <div className="display font-bold">
                API Keys
              </div>

              <div className="code text-[9px] uppercase tracking-widest text-[hsl(var(--soft))]">
                Connexions externes de NEXUS
              </div>
            </div>
          </div>

          <div className="mb-6 rounded-lg border border-[hsl(var(--amber)/.25)] bg-[hsl(var(--amber)/.05)] p-4">
            <div className="flex gap-3">
              <ShieldCheck
                size={17}
                className="mt-0.5 shrink-0 text-[hsl(var(--amber))]"
              />

              <div className="text-xs leading-5 text-[hsl(var(--soft))]">
                <strong className="text-[hsl(var(--text))]">
                  Vos clés restent dans ce navigateur.
                </strong>
                <p className="mt-1">
                  NEXUS les conserve uniquement dans le stockage local de cette
                  application. Ne partagez jamais une clé API dans une capture
                  d'écran ou dans un dépôt Git.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">

            <div>
              <label className="label">
                Groq API Key
              </label>

              <input
                className="field"
                type="password"
                value={groqKey}
                onChange={event => setGroqKey(event.target.value)}
                placeholder="gsk_..."
                autoComplete="off"
              />

              <p className="mt-2 text-xs leading-5 text-[hsl(var(--soft))]">
                Utilisée pour les fonctions IA distantes de NEXUS lorsque
                cette intégration est activée.
              </p>
            </div>

            <div>
              <label className="label">
                Tavily API Key
              </label>

              <input
                className="field"
                type="password"
                value={tavilyKey}
                onChange={event => setTavilyKey(event.target.value)}
                placeholder="tvly-..."
                autoComplete="off"
              />

              <p className="mt-2 text-xs leading-5 text-[hsl(var(--soft))]">
                Utilisée pour les recherches web et la récupération
                d'informations externes.
              </p>
            </div>

          </div>

          <div className="mt-6 flex flex-wrap gap-2">

            <button
              className="btn btn-primary"
              onClick={saveKeys}
            >
              <Check size={15}/>
              Enregistrer les clés
            </button>

            <button
              className="btn btn-quiet"
              onClick={clearKeys}
            >
              <Trash2 size={15}/>
              Effacer les clés
            </button>

          </div>

          {saved ? (
            <div
              className="mt-4 text-xs text-[hsl(var(--lime))]"
              role="status"
            >
              ✓ Paramètres API enregistrés localement.
            </div>
          ) : null}

        </section>

        <section className="panel rounded-xl p-5 sm:p-6">

          <SectionHeading
            icon={CircleHelp}
            title="À propos de NEXUS"
            detail="Tout ce qu'il faut savoir"
          />

          <div className="mt-6 grid gap-5 md:grid-cols-2">

            <div className="rounded-lg border border-[hsl(var(--line))] p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Zap size={15} className="text-[hsl(var(--cyan))]"/>
                Qu'est-ce que NEXUS ?
              </div>

              <p className="text-xs leading-6 text-[hsl(var(--soft))]">
                NEXUS est une interface personnelle destinée à rechercher,
                filtrer, comparer et surveiller des PC et des composants.
                L'objectif est de centraliser les critères, les recherches,
                les favoris et les alertes dans une seule console.
              </p>
            </div>

            <div className="rounded-lg border border-[hsl(var(--line))] p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Filter size={15} className="text-[hsl(var(--cyan))]"/>
                Comment fonctionne la recherche ?
              </div>

              <p className="text-xs leading-6 text-[hsl(var(--soft))]">
                Les critères définis dans NEXUS servent à filtrer les annonces
                et à calculer leur correspondance avec votre recherche.
                Budget, GPU, RAM, écran et autres critères peuvent être
                utilisés ensemble.
              </p>
            </div>

            <div className="rounded-lg border border-[hsl(var(--line))] p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Radio size={15} className="text-[hsl(var(--cyan))]"/>
                Recherche externe
              </div>

              <p className="text-xs leading-6 text-[hsl(var(--soft))]">
                Les services externes comme Tavily peuvent permettre à NEXUS
                d'effectuer des recherches web lorsque leur intégration est
                configurée. Une clé API valide peut être nécessaire.
              </p>
            </div>

            <div className="rounded-lg border border-[hsl(var(--line))] p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Bell size={15} className="text-[hsl(var(--cyan))]"/>
                Alertes
              </div>

              <p className="text-xs leading-6 text-[hsl(var(--soft))]">
                Les alertes servent à surveiller les recherches enregistrées
                et à signaler les nouveaux résultats ou changements détectés
                par les fonctions de veille de NEXUS.
              </p>
            </div>

            <div className="rounded-lg border border-[hsl(var(--line))] p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Heart size={15} className="text-[hsl(var(--cyan))]"/>
                Favoris et historique
              </div>

              <p className="text-xs leading-6 text-[hsl(var(--soft))]">
                Les favoris permettent de conserver les machines intéressantes.
                L'historique conserve les recherches effectuées afin de pouvoir
                suivre les recherches précédentes.
              </p>
            </div>

            <div className="rounded-lg border border-[hsl(var(--line))] p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Wifi size={15} className="text-[hsl(var(--cyan))]"/>
                Mode hors ligne
              </div>

              <p className="text-xs leading-6 text-[hsl(var(--soft))]">
                NEXUS dispose d'un fonctionnement PWA permettant de conserver
                l'interface disponible même lorsque la connexion est absente.
                Les fonctionnalités nécessitant Internet restent évidemment
                dépendantes du réseau.
              </p>
            </div>

          </div>

        </section>

        <section className="panel rounded-xl p-5 sm:p-6">

          <SectionHeading
            icon={ShieldCheck}
            title="Données et confidentialité"
            detail="Contrôle local"
          />

          <div className="mt-5 grid gap-4 text-xs leading-6 text-[hsl(var(--soft))] md:grid-cols-3">

            <div>
              <strong className="text-[hsl(var(--text))]">
                Données locales
              </strong>
              <p className="mt-1">
                Les paramètres et données de l'espace NEXUS sont conservés
                localement lorsque l'application utilise son stockage local.
              </p>
            </div>

            <div>
              <strong className="text-[hsl(var(--text))]">
                API séparées
              </strong>
              <p className="mt-1">
                Une clé API ne donne pas automatiquement accès à toutes les
                autres intégrations. Chaque service possède ses propres
                identifiants et permissions.
              </p>
            </div>

            <div>
              <strong className="text-[hsl(var(--text))]">
                Vous gardez le contrôle
              </strong>
              <p className="mt-1">
                Vous pouvez modifier ou supprimer les clés enregistrées
                directement depuis cette page.
              </p>
            </div>

          </div>

        </section>

        <section className="panel rounded-xl p-5 sm:p-6">

          <SectionHeading
            icon={CircleHelp}
            title="Configuration"
            detail="État actuel"
          />

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

            <div className="rounded-lg border border-[hsl(var(--line))] p-3">
              <div className="code text-[9px] uppercase tracking-wider text-[hsl(var(--soft))]">
                Groq
              </div>
              <div className="mt-1 text-sm font-semibold">
                {groqKey ? 'Configuré' : 'Non configuré'}
              </div>
            </div>

            <div className="rounded-lg border border-[hsl(var(--line))] p-3">
              <div className="code text-[9px] uppercase tracking-wider text-[hsl(var(--soft))]">
                Tavily
              </div>
              <div className="mt-1 text-sm font-semibold">
                {tavilyKey ? 'Configuré' : 'Non configuré'}
              </div>
            </div>

            <div className="rounded-lg border border-[hsl(var(--line))] p-3">
              <div className="code text-[9px] uppercase tracking-wider text-[hsl(var(--soft))]">
                OpenAI
              </div>
              <div className="mt-1 text-sm font-semibold">
                {openaiKey ? 'Configuré' : 'Non configuré'}
              </div>
            </div>

            <div className="rounded-lg border border-[hsl(var(--line))] p-3">
              <div className="code text-[9px] uppercase tracking-wider text-[hsl(var(--soft))]">
                Anthropic
              </div>
              <div className="mt-1 text-sm font-semibold">
                {anthropicKey ? 'Configuré' : 'Non configuré'}
              </div>
            </div>

          </div>

        </section>

      </div>
    </div>
  );
}

function buildSearchQuery(criteria: Criteria) {
  const parts = [
    "ordinateur portable",
    criteria.location && criteria.location !== "Tous"
      ? criteria.location
      : "France",
    criteria.minPrice > 0
      ? `a partir de ${criteria.minPrice} euros`
      : "",
    criteria.maxPrice > 0
      ? `moins de ${criteria.maxPrice} euros`
      : "",
    criteria.cpu !== "Tous" ? criteria.cpu : "",
    criteria.gpu !== "Tous" ? criteria.gpu : "",
    criteria.ram !== "Tous" ? criteria.ram : "",
    criteria.storage !== "Tous" ? criteria.storage : "",
    criteria.storageType !== "Tous" ? criteria.storageType : "",
    criteria.screen !== "Tous" ? criteria.screen : "",
    criteria.condition !== "Tous" ? criteria.condition : "",
    criteria.brands ? `marques ${criteria.brands}` : "",
    criteria.include ? criteria.include : "",
    criteria.exclude ? `sans ${criteria.exclude}` : "",
  ];

  return parts.filter(Boolean).join(" ");
}

function LiveSignalCard({ item, index }: { item: NexusSearchResult; index: number }) {
  return (
    <article className="panel rounded-xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="code mb-2 text-[9px] uppercase tracking-widest text-[hsl(var(--cyan))]">
            SOURCE {String(index + 1).padStart(2, "0")}
          </div>

          <h3 className="display text-base font-bold leading-6">
            {item.title || "Résultat sans titre"}
          </h3>

          <p className="mt-2 line-clamp-4 text-xs leading-5 text-[hsl(var(--soft))]">
            {item.content || "Aucun extrait disponible."}
          </p>
        </div>

        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-xs font-bold text-[hsl(var(--cyan))] hover:underline"
        >
          Ouvrir
        </a>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-[9px]">
        <span className="rounded-full border border-[hsl(var(--line))] px-2 py-1 text-[hsl(var(--soft))]">
          pertinence {Math.round((item.score || 0) * 100)}%
        </span>

        {item.publishedDate && (
          <span className="rounded-full border border-[hsl(var(--line))] px-2 py-1 text-[hsl(var(--soft))]">
            {item.publishedDate}
          </span>
        )}
      </div>
    </article>
  );
}

function Dashboard() {
  const { data, setData } = usenexus();

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"score" | "title">("score");
  const [active, setActive] = useState(true);
  const [results, setResults] = useState<NexusSearchResult[]>([]);
  const [analysis, setAnalysis] = useState<NexusSearchAnalysis | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [usage, setUsage] = useState<NexusUsage>(readNexusUsage());

  const updateCriteria = (patch: Partial<Criteria>) =>
    setData({
      ...data,
      criteria: {
        ...data.criteria,
        ...patch,
      },
    });

  const runSearch = async (
    criteria = data.criteria,
    phrase = ""
  ) => {
    if (searching) return;

    setSearching(true);
    setError("");
    setAnalysis(null);

    try {
      const searchQuery = phrase.trim()
        ? `${phrase.trim()} ${buildSearchQuery(criteria)}`
        : buildSearchQuery(criteria);

      const response = await runNexusSearch(searchQuery, 10);

      setResults(response.results);
      setUsage(readNexusUsage());

      const historyEntry = {
        id: `h-${Date.now()}`,
        query: searchQuery,
        date: new Date().toISOString(),
        results: response.results.length,
      };

      setData({
        ...data,
        criteria,
        history: [historyEntry, ...data.history].slice(0, 12),
      });

      if (response.results.length > 0) {
        try {
          const groqAnalysis = await analyzeNexusSearch(
            criteria as unknown as Record<string, unknown>,
            response.results
          );

          setAnalysis(groqAnalysis);
          setUsage(readNexusUsage());
        } catch (analysisError) {
          console.error(analysisError);
          setError(
            "Les résultats web sont disponibles, mais l'analyse Groq n'a pas pu être terminée."
          );
        }
      }
    } catch (searchError) {
      console.error(searchError);

      setResults([]);
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Impossible d'effectuer la recherche."
      );
    } finally {
      setSearching(false);
    }
  };

  const handleAssistant = async () => {
    const text = query.trim();

    if (!text || searching) return;

    const lower = text.toLowerCase();
    const next = { ...data.criteria };

    const budget = lower.match(
      /(?:moins de|max(?:imum)?|budget de?)\s*(\d[\d\s]*)\s*(?:€|euros)?/i
    );

    const gpu = ["RTX 4080", "RTX 4070", "RTX 4060"].find((item) =>
      lower.includes(item.toLowerCase())
    );

    const ram = lower.match(/(\d+)\s*go\s*(?:de ram|ram)?/i);
    const screen = lower.match(/(\d+(?:[.,]\d+)?)\s*pouces?/i);

    if (budget) {
      next.maxPrice = Number(budget[1].replace(/\s/g, ""));
    }

    if (gpu) {
      next.gpu = gpu;
    }

    if (ram) {
      next.ram = `${ram[1]} Go+`;
    }

    if (screen) {
      next.screen = `${screen[1].replace(",", ".")} pouces`;
    }

    const isSearch =
      /cherche|recherche|lance|trouve|scanne|cherche-moi/.test(lower);

    const response = isSearch
      ? "Recherche web réelle lancée. NEXUS interroge les sources puis analyse les résultats."
      : "Critères compris. Ils ont été appliqués à votre prochaine recherche.";

    setData({
      ...data,
      criteria: next,
      assistantLog: [
        ...data.assistantLog,
        { role: "user", text },
        { role: "nexus", text: response },
      ],
    });

    setQuery("");

    if (isSearch) {
      await runSearch(next, text);
    }
  };

  const sortedResults = useMemo(
    () =>
      [...results].sort((a, b) =>
        sort === "score"
          ? b.score - a.score
          : a.title.localeCompare(b.title, "fr")
      ),
    [results, sort]
  );

  return (
    <div className="mx-auto max-w-[1240px]">
      <PageTitle
        eyebrow="Console principale / recherche web"
        title="Votre prochain PC, sans le bruit."
      >
        <Link
          href="/criteria"
          className="btn btn-primary"
          data-testid="button-edit-criteria"
        >
          <SlidersHorizontal size={16} />
          Modifier les critères
        </Link>
      </PageTitle>

      <StatusBar active={active} />

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div className="panel rounded-xl p-4">
          <div className="code text-[9px] uppercase tracking-widest text-[hsl(var(--soft))]">
            TAVILY
          </div>
          <div className="mt-1 text-lg font-bold">
            {usage.tavilySearches} recherches
          </div>
          <div className="text-[10px] text-[hsl(var(--soft))]">
            Recherche web utilisée par NEXUS
          </div>
        </div>

        <div className="panel rounded-xl p-4">
          <div className="code text-[9px] uppercase tracking-widest text-[hsl(var(--soft))]">
            GROQ
          </div>
          <div className="mt-1 text-lg font-bold">
            {usage.groqCalls} analyses
          </div>
          <div className="text-[10px] text-[hsl(var(--soft))]">
            Analyses IA effectuées par NEXUS
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_330px]">
        <section className="min-w-0">
          <div className="panel grid-bg relative mb-5 overflow-hidden rounded-2xl p-5 sm:p-7">
            <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center">
              <div className="flex items-center gap-5">
                <div className="relative grid h-28 w-28 shrink-0 place-items-center rounded-full border border-[hsl(var(--cyan)/.4)] bg-[hsl(var(--bg)/.6)] glow">
                  <div className="absolute inset-3 rounded-full border border-dashed border-[hsl(var(--cyan)/.45)]" />
                  <div className="text-center">
                    <div className="code text-[9px] uppercase tracking-widest text-[hsl(var(--cyan))]">
                      {searching ? "SCAN" : active ? "READY" : "PAUSE"}
                    </div>
                    <div className="mt-1 text-2xl font-bold">
                      {results.length}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="code mb-2 text-[10px] uppercase tracking-widest text-[hsl(var(--soft))]">
                    Centre de contrôle
                  </div>

                  <h2 className="display text-2xl font-bold">
                    {searching
                      ? "Recherche en cours"
                      : active
                        ? "Recherche connectée"
                        : "Recherche suspendue"}
                  </h2>

                  <p className="mt-1 max-w-md text-sm leading-6 text-[hsl(var(--soft))]">
                    NEXUS recherche sur le web, puis utilise Groq pour analyser
                    les résultats selon vos critères.
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:ml-auto lg:flex-col">
                <button
                  className="btn btn-primary"
                  disabled={searching}
                  onClick={() => {
                    setActive(true);
                    void runSearch();
                  }}
                  data-testid="button-run-search"
                >
                  {searching ? "Recherche..." : "Lancer la recherche"}
                </button>

                <button
                  className="btn"
                  onClick={() => {
                    setActive(!active);
                  }}
                  data-testid="button-pause-search"
                >
                  {active ? "Mettre en pause" : "Reprendre"}
                </button>
              </div>
            </div>
          </div>

          <Assistant
            query={query}
            setQuery={setQuery}
            onSend={() => void handleAssistant()}
            logs={data.assistantLog}
          />

          {error && (
            <div className="mt-5 rounded-xl border border-red-400/30 bg-red-400/5 p-4 text-xs leading-5 text-red-200">
              {error}
            </div>
          )}

          {analysis && (
            <div className="panel mt-5 rounded-xl p-5">
              <div className="code text-[10px] uppercase tracking-widest text-[hsl(var(--cyan))]">
                Analyse NEXUS / GROQ
              </div>

              <p className="mt-3 text-sm leading-6">
                {analysis.summary}
              </p>

              {analysis.recommendations.length > 0 && (
                <div className="mt-4 space-y-2">
                  {analysis.recommendations.map((recommendation) => {
                    const source = results[recommendation.index];

                    if (!source) return null;

                    return (
                      <div
                        key={`${recommendation.index}-${recommendation.reason}`}
                        className="rounded-lg border border-[hsl(var(--line))] p-3"
                      >
                        <div className="text-xs font-bold">
                          {source.title}
                        </div>
                        <div className="mt-1 text-[11px] leading-5 text-[hsl(var(--soft))]">
                          {recommendation.reason}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="mb-3 mt-7 flex items-center justify-between">
            <div>
              <div className="code text-[10px] uppercase tracking-widest text-[hsl(var(--soft))]">
                Sources web
              </div>

              <h2 className="display mt-1 text-xl font-bold">
                {sortedResults.length} résultats trouvés
              </h2>
            </div>

            <select
              className="field w-auto py-2 text-xs"
              value={sort}
              onChange={(event) =>
                setSort(event.target.value as "score" | "title")
              }
              data-testid="select-sort"
            >
              <option value="score">Trier par pertinence</option>
              <option value="title">Trier par titre</option>
            </select>
          </div>

          {sortedResults.length > 0 ? (
            <div className="space-y-3">
              {sortedResults.map((item, index) => (
                <LiveSignalCard
                  key={`${item.url}-${index}`}
                  item={item}
                  index={index}
                />
              ))}
            </div>
          ) : (
            <div className="panel rounded-xl p-6 text-center">
              <div className="display font-bold">
                Aucune recherche effectuée
              </div>

              <p className="mt-2 text-xs leading-5 text-[hsl(var(--soft))]">
                Décris le PC recherché dans l'assistant ou lance une recherche
                avec les critères actuels.
              </p>
            </div>
          )}

          <CompareBar />
        </section>

        <aside className="space-y-5">
          <QuickCriteria
            criteria={data.criteria}
            onChange={updateCriteria}
          />

          <div className="panel rounded-xl p-5">
            <div className="mb-3">
              <div className="code text-[10px] uppercase tracking-widest text-[hsl(var(--soft))]">
                NEXUS LIVE
              </div>

              <h3 className="display mt-1 font-bold">
                Recherche connectée
              </h3>
            </div>

            <p className="text-xs leading-5 text-[hsl(var(--soft))]">
              Les recherches utilisent Tavily. Les résultats sont ensuite
              analysés par Groq sans exposer les clés API dans le navigateur.
            </p>

            <Link
              href="/notifications"
              className="mt-4 flex items-center gap-2 text-xs font-bold text-[hsl(var(--cyan))]"
              data-testid="link-learn-notifications"
            >
              Configurer les alertes
              <ChevronRight size={14} />
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
function Assistant({ query, setQuery, onSend, logs }: { query: string; setQuery: (x:string)=>void; onSend:()=>void; logs: AppData['assistantLog'] }) { return <div className="panel rounded-xl p-4 sm:p-5"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><div className="grid h-8 w-8 place-items-center rounded-lg bg-[hsl(var(--cyan)/.12)] text-[hsl(var(--cyan))]"><Bot size={17}/></div><div><div className="display text-sm font-bold">Assistant NEXUS</div><div className="code text-[9px] uppercase tracking-widest text-[hsl(var(--soft))]">Compréhension française / locale</div></div></div><Sparkles size={15} className="text-[hsl(var(--lime))]"/></div><div className="mb-4 max-h-28 space-y-2 overflow-y-auto pr-1">{logs.slice(-3).map((log, i) => <div key={`${log.text}-${i}`} className={`flex gap-2 text-xs leading-5 ${log.role === 'user' ? 'text-[hsl(var(--text))]' : 'text-[hsl(var(--soft))]'}`}><span className="code shrink-0 text-[10px] text-[hsl(var(--cyan))]">{log.role === 'user' ? 'VOUS' : 'NEXUS'}</span><span>{log.text}</span></div>)}</div><div className="flex gap-2"><input className="field min-w-0" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && onSend()} placeholder="Ex. cherche un RTX 4070 Ã  moins de 1 800 â‚¬" data-testid="input-assistant"/><button className="btn btn-primary px-3" onClick={onSend} aria-label="Envoyer" data-testid="button-send-assistant"><ChevronRight size={18}/></button></div><div className="mt-3 flex flex-wrap gap-2">{['RTX 4070 Ã  moins de 1 800 â‚¬','16 Go, 15 pouces','Lance une recherche démo'].map(s => <button key={s} className="rounded-full border border-[hsl(var(--line))] px-2.5 py-1 text-[10px] text-[hsl(var(--soft))] hover:border-[hsl(var(--cyan)/.5)] hover:text-[hsl(var(--cyan))]" onClick={() => setQuery(s)} data-testid={`button-suggestion-${s.slice(0,4)}`}>{s}</button>)}</div></div>; }

function QuickCriteria({ criteria, onChange }: { criteria: Criteria; onChange: (p:Partial<Criteria>)=>void }) { return <div className="panel rounded-xl p-5"><div className="mb-4 flex items-center justify-between"><div><div className="code text-[10px] uppercase tracking-widest text-[hsl(var(--soft))]">Filtre actif</div><h3 className="display mt-1 font-bold">Vos critères</h3></div><Filter size={16} className="text-[hsl(var(--cyan))]"/></div><div className="space-y-4"><div><label className="label">Budget maximum</label><div className="flex items-center gap-2"><input className="field py-2 text-sm" type="number" value={criteria.maxPrice} onChange={e => onChange({ maxPrice:Number(e.target.value) })} data-testid="input-max-price"/><span className="code text-xs text-[hsl(var(--soft))]">â‚¬</span></div></div><div><label className="label">Carte graphique</label><select className="field py-2 text-sm" value={criteria.gpu} onChange={e => onChange({ gpu:e.target.value })} data-testid="select-gpu"><option>Tous</option><option>RTX 4060</option><option>RTX 4070</option><option>RTX 4080</option></select></div><div><label className="label">Mémoire vive</label><select className="field py-2 text-sm" value={criteria.ram} onChange={e => onChange({ ram:e.target.value })} data-testid="select-ram"><option>Tous</option><option>16 Go+</option><option>32 Go+</option></select></div></div><Link href="/criteria" className="mt-5 flex items-center justify-center gap-2 text-xs font-bold text-[hsl(var(--cyan))]" data-testid="link-all-criteria">Tous les critères <ChevronRight size={14}/></Link></div>; }

function ListingCard({ item }: { item: Listing }) { const { data, setData } = usenexus(); const favorite = data.favorites.includes(item.id); const compared = data.compared.includes(item.id); const toggle = (key: 'favorites'|'compared') => { const list = data[key]; setData({ ...data, [key]: list.includes(item.id) ? list.filter(x => x !== item.id) : [...list, item.id] }); }; return <article className="panel panel-hover rounded-xl p-4" data-testid={`card-listing-${item.id}`}><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className="grid h-24 w-full shrink-0 place-items-center rounded-lg border border-[hsl(var(--line))] bg-[hsl(var(--bg)/.5)] sm:w-32"><Laptop size={39} strokeWidth={1.2} style={{ color:item.accent }}/><span className="code text-[8px] uppercase tracking-wider text-[hsl(var(--soft))]">DEMO UNIT</span></div><div className="min-w-0 flex-1"><div className="mb-1 flex flex-wrap items-center gap-2"><span className="rounded border border-[hsl(var(--amber)/.35)] px-1.5 py-0.5 code text-[8px] uppercase tracking-wider text-[hsl(var(--amber))]">DONNÃ‰E DE DÃ‰MONSTRATION</span><span className="text-[10px] text-[hsl(var(--soft))]">{item.published}</span></div><h3 className="display text-lg font-bold">{item.brand} {item.model}</h3><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[hsl(var(--soft))]"><span className="flex items-center gap-1"><Cpu size={12}/> {item.cpu}</span><span>{item.gpu}</span><span>{item.ram}</span><span>{item.storage} {item.storageType}</span><span>{item.screen}</span></div><div className="mt-3 flex flex-wrap items-center gap-2"><span className="text-lg font-bold text-[hsl(var(--cyan))]">{item.price.toLocaleString('fr-FR')} â‚¬</span><span className="text-[10px] text-[hsl(var(--soft))]">{item.condition} Â· {item.location}</span></div></div><div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end"><div className="text-right"><div className="code text-[9px] uppercase tracking-widest text-[hsl(var(--soft))]">Score intérêt</div><div className="display text-2xl font-bold text-[hsl(var(--lime))]">{item.score}<span className="text-sm">/100</span></div></div><div className="flex gap-1"><button className={`btn p-2 ${favorite ? 'border-[hsl(var(--red)/.5)] text-[hsl(var(--red))]' : 'btn-quiet'}`} onClick={() => toggle('favorites')} aria-label="Ajouter aux favoris" data-testid={`button-favorite-${item.id}`}><Heart size={16} fill={favorite ? 'currentColor' : 'none'}/></button><button className={`btn p-2 ${compared ? 'border-[hsl(var(--cyan)/.6)] text-[hsl(var(--cyan))]' : 'btn-quiet'}`} onClick={() => toggle('compared')} aria-label="Comparer" data-testid={`button-compare-${item.id}`}><Check size={16}/></button></div></div></div></article>; }
function EmptyResults({ onReset }: { onReset:()=>void }) { return <div className="panel rounded-xl px-6 py-14 text-center"><PackageOpen size={32} className="mx-auto mb-3 text-[hsl(var(--soft))]"/><h3 className="display text-lg font-bold">Aucun signal dans cette zone</h3><p className="mx-auto mt-2 max-w-sm text-sm text-[hsl(var(--soft))]">Les critères actuels sont peut-être trop précis pour le jeu de données démo.</p><button className="btn mt-5" onClick={onReset} data-testid="button-reset-results">Réinitialiser les critères</button></div>; }
function CompareBar() { const { data, setData } = usenexus(); const selected = listings.filter(x => data.compared.includes(x.id)); if (!selected.length) return null; return <div className="panel sticky bottom-4 z-10 mt-5 rounded-xl border-[hsl(var(--cyan)/.4)] p-4 glow"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="code text-[9px] uppercase tracking-widest text-[hsl(var(--cyan))]">Comparaison active</div><div className="mt-1 text-sm font-semibold">{selected.length} machine{selected.length > 1 ? 's' : ''} sélectionnée{selected.length > 1 ? 's' : ''}</div></div><div className="flex flex-wrap gap-2">{selected.map(item => <span key={item.id} className="rounded-full bg-[hsl(var(--cyan)/.1)] px-2 py-1 text-[10px] text-[hsl(var(--cyan))]">{item.brand} {item.model}</span>)}<button className="btn btn-primary py-1.5 text-xs" onClick={() => alert(selected.map(x => `${x.brand} ${x.model}: ${x.price} â‚¬ / score ${x.score}`).join('\n'))} data-testid="button-open-compare">Voir la comparaison</button><button className="btn btn-quiet p-1.5" onClick={() => setData({ ...data, compared:[] })} aria-label="Effacer comparaison" data-testid="button-clear-compare"><X size={15}/></button></div></div></div>; }

function CriteriaPage() { const { data, setData } = usenexus(); const [form, setForm] = useState(data.criteria); const [saved, setSaved] = useState(false); function set<K extends keyof Criteria>(key: K, value: Criteria[K]) { setForm({ ...form, [key]: value }); } const save = () => { setData({ ...data, criteria: form }); setSaved(true); window.setTimeout(() => setSaved(false), 1800); }; return <div className="mx-auto max-w-[1000px]"><PageTitle eyebrow="Configuration / profil de recherche" title="Définir votre terrain de jeu"><button className="btn btn-primary" onClick={save} data-testid="button-save-criteria">{saved ? <Check size={16}/> : <Zap size={16}/>} {saved ? 'Critères sauvegardés' : 'Sauvegarder les critères'}</button></PageTitle><div className="panel rounded-2xl p-5 sm:p-7"><div className="mb-7 flex items-start gap-3 border-b border-[hsl(var(--line))] pb-5"><SlidersHorizontal className="mt-1 text-[hsl(var(--cyan))]" size={20}/><div><h2 className="display text-xl font-bold">Le brief de recherche</h2><p className="mt-1 text-sm text-[hsl(var(--soft))]">Ces préférences sont enregistrées uniquement dans ce navigateur.</p></div></div><div className="grid gap-6 md:grid-cols-2"><div className="space-y-5"><div><label className="label">Budget (â‚¬)</label><div className="grid grid-cols-2 gap-3"><input className="field" type="number" value={form.minPrice} onChange={e=>set('minPrice', Number(e.target.value))} placeholder="Minimum" data-testid="input-criteria-min"/><input className="field" type="number" value={form.maxPrice} onChange={e=>set('maxPrice', Number(e.target.value))} placeholder="Maximum" data-testid="input-criteria-max"/></div></div><Field label="Processeur" value={form.cpu} onChange={v=>set('cpu',v)} options={['Tous','Intel Core i7','Intel Core Ultra 7','AMD Ryzen 7','Intel Core i9']}/><Field label="Carte graphique" value={form.gpu} onChange={v=>set('gpu',v)} options={['Tous','RTX 4060','RTX 4070','RTX 4080']}/><Field label="RAM" value={form.ram} onChange={v=>set('ram',v)} options={['Tous','16 Go+','32 Go+']}/><Field label="Stockage minimum" value={form.storage} onChange={v=>set('storage',v)} options={['Tous','512 Go+','1 To+','2 To+']}/></div><div className="space-y-5"><Field label="Type de stockage" value={form.storageType} onChange={v=>set('storageType',v)} options={['Tous','SSD','SSD NVMe']}/><Field label="Taille écran" value={form.screen} onChange={v=>set('screen',v)} options={['Tous','14 pouces','15.6 pouces','16 pouces']}/><Field label="Ã‰tat" value={form.condition} onChange={v=>set('condition',v)} options={['Tous','Neuf','Très bon état','Reconditionné','Bon état']}/><div><label className="label">Localisation</label><input className="field" value={form.location} onChange={e=>set('location',e.target.value)} data-testid="input-location"/></div><div><label className="label">Marques préférées <span className="normal-case tracking-normal opacity-70">(séparées par virgule)</span></label><input className="field" value={form.brands} onChange={e=>set('brands',e.target.value)} placeholder="ASUS, Lenovo" data-testid="input-brands"/></div></div></div><div className="mt-7 grid gap-5 border-t border-[hsl(var(--line))] pt-6 md:grid-cols-2"><div><label className="label">Mots-clés requis</label><input className="field" value={form.include} onChange={e=>set('include',e.target.value)} placeholder="ex. creator, silencieux" data-testid="input-include"/></div><div><label className="label">Mots-clés exclus</label><input className="field" value={form.exclude} onChange={e=>set('exclude',e.target.value)} placeholder="ex. 4K, sans chargeur" data-testid="input-exclude"/></div></div></div></div>; }
function Field({ label, value, onChange, options }: { label:string; value:string; onChange:(v:string)=>void; options:string[] }) { return <div><label className="label">{label}</label><select className="field" value={value} onChange={e=>onChange(e.target.value)} data-testid={`select-${label.toLowerCase().replaceAll(' ','-')}`}>{options.map(o=><option key={o}>{o}</option>)}</select></div>; }

function AIStatusCard({ status, loading, onRefresh }: { status: AIStatus | null; loading: boolean; onRefresh: () => void }) {
  const connected = status?.available && status.models.length > 0;
  return <div className="panel rounded-xl p-5 sm:p-6">
    <div className="flex items-start justify-between gap-4">
      <SectionHeading icon={Server} title="Local AI" detail="Ollama / serveur local"/>
      <button className="btn btn-quiet p-2" onClick={onRefresh} disabled={loading} aria-label="Actualiser le statut IA" data-testid="button-refresh-ai-status"><RefreshCw size={15} className={loading ? 'animate-spin' : ''}/></button>
    </div>
    <div className="mt-5 flex items-center gap-3 rounded-lg border border-[hsl(var(--line))] bg-[hsl(var(--bg)/.4)] p-3">
      <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-[hsl(var(--lime))]' : 'bg-[hsl(var(--amber))]'}`}/>
      <div><div className="text-sm font-semibold">{loading ? 'Vérification en coursâ€¦' : connected ? 'Connecté' : 'Indisponible'}</div><div className="code mt-1 text-[9px] uppercase tracking-wider text-[hsl(var(--soft))]">{status?.provider ?? 'ollama'} Â· {status?.configuredModel || 'modèle Ã  choisir'}</div></div>
    </div>
    <p className="mt-4 text-xs leading-5 text-[hsl(var(--soft))]">{status?.message || 'NEXUS vérifie si Ollama est accessible depuis le serveur.'}</p>
    {!connected && !loading ? <div className="mt-4 flex gap-2 rounded-lg border border-[hsl(var(--amber)/.3)] bg-[hsl(var(--amber)/.06)] p-3 text-xs leading-5 text-[hsl(var(--amber))]"><AlertTriangle size={16} className="mt-0.5 shrink-0"/><span>NEXUS ne prétend pas être local tant quâ€™aucun modèle n’est détecté. Installez Ollama sur la machine qui exécute le serveur, puis configurez OLLAMA_BASE_URL si nécessaire.</span></div> : null}
  </div>;
}

function ChatPage() {
  const { data, setData } = usenexus();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const activeConversation = data.conversations.find(
    conversation => conversation.id === activeConversationId
  );

  const messages = activeConversation?.messages ?? [];

  const loadStatus = async () => {
    setStatusLoading(true);

    try {
      setStatus(await getAIStatus());
    } catch (reason) {
      setStatus(null);
      setError(
        reason instanceof Error
          ? reason.message
          : 'Statut IA indisponible.'
      );
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const createConversation = () => {
    const now = new Date().toISOString();

    const conversation = {
      id: `conversation-${Date.now()}`,
      title: 'Nouvelle conversation',
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    setData({
      ...data,
      conversations: [
        conversation,
        ...data.conversations,
      ],
    });

    setActiveConversationId(conversation.id);
    setDraft('');
    setError('');
  };

  const send = async () => {
    const text = draft.trim();

    if (!text || busy) return;

    let conversation = activeConversation;

    if (!conversation) {
      const now = new Date().toISOString();

      conversation = {
        id: `conversation-${Date.now()}`,
        title:
          text.length > 42
            ? `${text.slice(0, 42)}…`
            : text,
        messages: [],
        createdAt: now,
        updatedAt: now,
      };

      setActiveConversationId(conversation.id);
    }

    const userEntry = {
      role: 'user' as const,
      text,
      date: new Date().toISOString(),
    };

    const nextMessages = [
      ...conversation.messages,
      userEntry,
    ].slice(-12);

    const exists = data.conversations.some(
      item => item.id === conversation!.id
    );

    const nextConversations = exists
      ? data.conversations.map(item =>
          item.id === conversation!.id
            ? {
                ...item,
                title:
                  item.title === 'Nouvelle conversation'
                    ? text.length > 42
                      ? `${text.slice(0, 42)}…`
                      : text
                    : item.title,
                messages: nextMessages,
                updatedAt: new Date().toISOString(),
              }
            : item
        )
      : [
          {
            ...conversation,
            title:
              text.length > 42
                ? `${text.slice(0, 42)}…`
                : text,
            messages: nextMessages,
            updatedAt: new Date().toISOString(),
          },
          ...data.conversations,
        ];

    setData({
      ...data,
      conversations: nextConversations,
    });

    setDraft('');
    setError('');
    setBusy(true);

    try {
      const agent = await runNexusAgent(
        nextMessages.map(entry => ({
          role: entry.role,
          content: entry.text,
        }))
      );

      const answer =
        agent.reply ||
        'Je peux vous aider avec cette demande.';

      const response = {
        role: 'assistant' as const,
        text: answer,
        date: new Date().toISOString(),
        model:
          data.aiSettings.model ||
          'openai/gpt-oss-120b',
      };

      const finalMessages = [
        ...nextMessages,
        response,
      ].slice(-12);

      setData({
        ...data,
        conversations: nextConversations.map(item =>
          item.id === conversation!.id
            ? {
                ...item,
                messages: finalMessages,
                updatedAt: new Date().toISOString(),
              }
            : item
        ),
      });

      setStatus(current =>
        current
          ? {
              ...current,
              available: true,
              configuredModel: response.model,
              message: `Réponse reçue avec ${response.model}.`,
            }
          : current
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'La réponse locale n’a pas pu être obtenue.'
      );
    } finally {
      setBusy(false);
    }
  };

  const deleteConversation = (id: string) => {
    const remaining = data.conversations.filter(
      conversation => conversation.id !== id
    );

    setData({
      ...data,
      conversations: remaining,
    });

    if (activeConversationId === id) {
      setActiveConversationId(null);
    }
  };

  const connected = Boolean(
    status?.available &&
    status.models.length
  );

  return (
    <div className="mx-auto max-w-[1250px]">
      <PageTitle
        eyebrow="Assistant personnel / cerveau local"
        title="NEXUS Chat"
      />

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">

        <aside className="panel rounded-2xl p-4">
          <div className="mb-4">
            <div className="display font-bold">
              Conversations
            </div>

            <div className="code mt-1 text-[9px] uppercase tracking-widest text-[hsl(var(--soft))]">
              {data.conversations.length} sauvegardée
              {data.conversations.length !== 1 ? 's' : ''}
            </div>
          </div>

          <button
            className="btn btn-primary mb-4 w-full"
            onClick={createConversation}
            data-testid="button-new-conversation"
          >
            <MessageSquare size={15} />
            Nouvelle conversation
          </button>

          <div className="space-y-2">
            {data.conversations.length ? (
              data.conversations.map(conversation => (
                <div
                  key={conversation.id}
                  className={`group flex items-center gap-2 rounded-lg border p-3 transition ${
                    activeConversationId === conversation.id
                      ? 'border-[hsl(var(--cyan)/.4)] bg-[hsl(var(--cyan)/.08)]'
                      : 'border-[hsl(var(--line))] hover:bg-[hsl(var(--bg)/.5)]'
                  }`}
                >
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() =>
                      setActiveConversationId(conversation.id)
                    }
                  >
                    <div className="truncate text-sm font-semibold">
                      {conversation.title}
                    </div>

                    <div className="code mt-1 text-[9px] text-[hsl(var(--soft))]">
                      {new Date(
                        conversation.updatedAt
                      ).toLocaleDateString('fr-FR')}
                    </div>
                  </button>

                  <button
                    className="rounded p-1.5 text-[hsl(var(--soft))] hover:text-[hsl(var(--red))]"
                    onClick={() =>
                      deleteConversation(conversation.id)
                    }
                    aria-label="Supprimer la conversation"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-[hsl(var(--line))] p-4 text-center">
                <MessageSquare
                  size={22}
                  className="mx-auto mb-2 text-[hsl(var(--soft))]"
                />

                <p className="text-xs text-[hsl(var(--soft))]">
                  Aucune conversation sauvegardée.
                </p>
              </div>
            )}
          </div>
        </aside>

        <section className="panel flex min-h-[620px] flex-col rounded-2xl p-4 sm:p-6">

          <div className="mb-5 flex items-center justify-between border-b border-[hsl(var(--line))] pb-4">

            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-[hsl(var(--cyan)/.12)] text-[hsl(var(--cyan))]">
                <Bot size={18} />
              </div>

              <div>
                <div className="display font-bold">
                  {activeConversation
                    ? activeConversation.title
                    : 'Nouvelle conversation'}
                </div>

                <div className="code text-[9px] uppercase tracking-widest text-[hsl(var(--soft))]">
                  {busy
                    ? 'THINKING / RÉPONSE EN COURS'
                    : connected
                      ? 'LOCAL AI / PRÊT'
                      : 'LOCAL AI / EN ATTENTE'}
                </div>
              </div>
            </div>

            <span
              className={`rounded-full border px-2.5 py-1 code text-[9px] uppercase tracking-wider ${
                connected
                  ? 'border-[hsl(var(--lime)/.35)] text-[hsl(var(--lime))]'
                  : 'border-[hsl(var(--amber)/.35)] text-[hsl(var(--amber))]'
              }`}
            >
              {connected
                ? 'IA connectée'
                : 'IA indisponible'}
            </span>
          </div>

          <div
            className="flex-1 space-y-4 overflow-y-auto pr-1"
            aria-live="polite"
          >
            {messages.length ? (
              messages.map((entry, index) => (
                <div
                  key={`${entry.date}-${index}`}
                  className={`flex gap-3 ${
                    entry.role === 'user'
                      ? 'justify-end'
                      : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[88%] rounded-xl border px-4 py-3 text-sm leading-6 ${
                      entry.role === 'user'
                        ? 'border-[hsl(var(--cyan)/.35)] bg-[hsl(var(--cyan)/.08)]'
                        : 'border-[hsl(var(--line))] bg-[hsl(var(--bg)/.45)]'
                    }`}
                  >
                    <div className="code mb-1 text-[9px] uppercase tracking-widest text-[hsl(var(--soft))]">
                      {entry.role === 'user'
                        ? 'Vous'
                        : `NEXUS${
                            entry.model
                              ? ` · ${entry.model}`
                              : ''
                          }`}
                    </div>

                    <div className="whitespace-pre-wrap">
                      {entry.text}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="grid h-full min-h-[360px] place-items-center text-center">
                <div>
                  <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border border-[hsl(var(--cyan)/.35)] text-[hsl(var(--cyan))] glow">
                    <Brain size={24} />
                  </div>

                  <h2 className="display text-xl font-bold">
                    Votre assistant local est prêt
                  </h2>

                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[hsl(var(--soft))]">
                    Créez une nouvelle conversation
                    ou sélectionnez une conversation
                    sauvegardée.
                  </p>

                  {!activeConversation && (
                    <button
                      className="btn btn-primary mt-5"
                      onClick={createConversation}
                    >
                      <MessageSquare size={15} />
                      Commencer
                    </button>
                  )}
                </div>
              </div>
            )}

            {busy ? (
              <div className="flex items-center gap-2 text-xs text-[hsl(var(--cyan))]">
                <span className="pulse-ring block h-2 w-2 rounded-full bg-[hsl(var(--cyan))]" />
                NEXUS prépare une réponse…
              </div>
            ) : null}
          </div>

          {error ? (
            <div
              className="mt-4 flex gap-2 rounded-lg border border-[hsl(var(--red)/.3)] bg-[hsl(var(--red)/.06)] p-3 text-xs leading-5 text-[hsl(var(--red))]"
              role="alert"
            >
              <AlertTriangle
                size={15}
                className="mt-0.5 shrink-0"
              />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="mt-5 border-t border-[hsl(var(--line))] pt-4">
            <div className="flex items-end gap-2">

              <textarea
                className="field min-h-[74px] resize-y"
                value={draft}
                onChange={event =>
                  setDraft(event.target.value)
                }
                onKeyDown={event => {
                  if (
                    event.key === 'Enter' &&
                    (event.metaKey || event.ctrlKey)
                  ) {
                    void send();
                  }
                }}
                placeholder="Écrivez à NEXUS…"
                maxLength={4000}
                data-testid="input-local-chat"
              />

              <button
                className="btn btn-primary h-[74px] px-4"
                onClick={() => void send()}
                disabled={!draft.trim() || busy}
                aria-label="Envoyer le message"
                data-testid="button-send-local-chat"
              >
                <Send size={17} />
              </button>

            </div>

            <div className="mt-2 flex justify-between code text-[9px] uppercase tracking-wider text-[hsl(var(--soft))]">
              <span>
                {data.aiSettings.model ||
                  'Modèle automatique'}
              </span>

              <span>
                {draft.length}/4000
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
function SubscriptionPage() {
  const { data, setData } = usenexus();
  const subscription = data.subscription;

  const plans = [
    {
      id: 'free' as const,
      name: 'Free',
      price: '0 €',
      description: 'L’essentiel pour découvrir NEXUS.',
      accent: 'text-[hsl(var(--soft))]',
      features: [
        'Recherche de PC',
        'Critères personnalisés',
        'Favoris',
        'Historique',
        'NEXUS Chat',
      ],
    },
    {
      id: 'plus' as const,
      name: 'Plus',
      price: '2,49 €',
      description: 'Pour une utilisation régulière de NEXUS.',
      accent: 'text-[hsl(var(--cyan))]',
      features: [
        'Tout le plan Free',
        'Plus de conversations',
        'Fonctions NEXUS avancées',
        'Recherche enrichie',
        'Priorité sur certaines fonctions',
      ],
    },
    {
      id: 'pro' as const,
      name: 'Pro',
      price: '4,99 €',
      description: 'Pour profiter pleinement des capacités avancées.',
      accent: 'text-[hsl(var(--lime))]',
      features: [
        'Tout le plan Plus',
        'Fonctions IA avancées',
        'Conversations étendues',
        'Paramètres avancés',
        'Fonctions Pro à venir',
      ],
    },
  ];

  const choosePlan = async (tier: 'free' | 'plus' | 'pro') => {
    if (tier === 'free') {
      setData({
        ...data,
        subscription: {
          ...subscription,
          tier: 'free',
          status: 'active',
        },
      });
      return;
    }

    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tier }),
      });

      const result = await response.json();

      if (!response.ok || !result.url) {
        throw new Error(result.error || 'Impossible d’ouvrir Stripe Checkout.');
      }

      window.location.href = result.url;
    } catch (error) {
      console.error('Checkout error:', error);
      alert(
        error instanceof Error
          ? error.message
          : 'Impossible d’ouvrir le paiement Stripe.'
      );
    }
  };

  return (
    <div className="space-y-8 fade-up">
      <PageTitle
        eyebrow="NEXUS MEMBERSHIP"
        title="Choisis ton expérience NEXUS"
      >
        <div className="rounded-lg border border-[hsl(var(--line))] bg-[hsl(var(--panel)/.6)] px-4 py-2 text-xs text-[hsl(var(--soft))]">
          Plan actuel : <span className="font-semibold text-white">{subscription.role === 'owner' ? 'Owner' : subscription.tier}</span>
        </div>
      </PageTitle>

      {subscription.role === 'owner' && (
        <section className="rounded-2xl border border-[hsl(var(--amber)/.35)] bg-[hsl(var(--amber)/.06)] p-5">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[hsl(var(--amber)/.3)] bg-[hsl(var(--amber)/.08)]">
              <Crown size={21} className="text-[hsl(var(--amber))]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-[hsl(var(--amber))]">NEXUS Owner</h2>
                <span className="rounded-full border border-[hsl(var(--amber)/.3)] px-2 py-0.5 text-[9px] uppercase tracking-wider text-[hsl(var(--amber))]">
                  Owner
                </span>
              </div>
              <p className="mt-1 text-sm leading-6 text-[hsl(var(--soft))]">
                Accès propriétaire de cette instance. Le statut Owner n’est pas achetable depuis cette boutique.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-5 lg:grid-cols-3">
        {plans.map((plan) => {
          const active = subscription.role !== 'owner' && subscription.tier === plan.id;

          return (
            <article
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border p-6 transition ${
                active
                  ? 'border-[hsl(var(--cyan)/.5)] bg-[hsl(var(--cyan)/.06)] shadow-[0_0_35px_hsl(var(--cyan)/.08)]'
                  : 'border-[hsl(var(--line))] bg-[hsl(var(--panel)/.5)] hover:border-[hsl(var(--cyan)/.25)]'
              }`}
            >
              {plan.id === 'plus' && (
                <div className="absolute -top-3 left-6 rounded-full bg-[hsl(var(--cyan))] px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-[hsl(var(--bg))]">
                  Populaire
                </div>
              )}

              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`code text-[10px] uppercase tracking-[.18em] ${plan.accent}`}>
                    NEXUS
                  </p>
                  <h2 className="display mt-2 text-2xl font-bold text-white">
                    {plan.name}
                  </h2>
                </div>

                {active && (
                  <span className="rounded-full border border-[hsl(var(--cyan)/.3)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-[hsl(var(--cyan))]">
                    Actuel
                  </span>
                )}
              </div>

              <div className="mt-6">
                <span className="display text-3xl font-bold text-white">{plan.price}</span>
                {plan.id !== 'free' && (
                  <span className="ml-1 text-xs text-[hsl(var(--soft))]">/ mois</span>
                )}
              </div>

              <p className="mt-3 min-h-[42px] text-sm leading-6 text-[hsl(var(--soft))]">
                {plan.description}
              </p>

              <div className="my-6 h-px bg-[hsl(var(--line))]" />

              <ul className="flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-[hsl(var(--text))]">
                    <Check size={15} className="mt-0.5 shrink-0 text-[hsl(var(--cyan))]" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                disabled={active}
                onClick={() => choosePlan(plan.id)}
                className={`mt-7 w-full rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  active
                    ? 'cursor-default border border-[hsl(var(--line))] bg-transparent text-[hsl(var(--soft))]'
                    : plan.id === 'pro'
                      ? 'bg-[hsl(var(--lime))] text-[hsl(var(--bg))] hover:opacity-90'
                      : plan.id === 'plus'
                        ? 'bg-[hsl(var(--cyan))] text-[hsl(var(--bg))] hover:opacity-90'
                        : 'border border-[hsl(var(--line))] bg-[hsl(var(--panel))] text-white hover:bg-[hsl(var(--panel)/.8)]'
                }`}
              >
                {active ? 'Plan actuel' : plan.id === 'free' ? 'Utiliser Free' : `Choisir ${plan.name}`}
              </button>
            </article>
          );
        })}
      </section>

      <section className="rounded-2xl border border-[hsl(var(--line))] bg-[hsl(var(--panel)/.4)] p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck size={18} className="mt-0.5 text-[hsl(var(--cyan))]" />
          <div>
            <h3 className="text-sm font-semibold text-white">Paiement sécurisé avec Stripe</h3>
            <p className="mt-1 text-xs leading-5 text-[hsl(var(--soft))]">
              Les abonnements Plus et Pro sont payés via Stripe Checkout. Le statut d’abonnement sera
              confirmé côté serveur après le paiement.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function HistoryPage() { const { data, setData } = usenexus(); const rerun = (query:string) => { setData({ ...data, history:[{ id:`h-${Date.now()}`, query, date:new Date().toISOString(), results:matchListings(data.criteria).length }, ...data.history] }); }; return <div className="mx-auto max-w-[1000px]"><PageTitle eyebrow="Journal des opérations" title="Historique de recherche"><button className="btn btn-quiet" onClick={()=>setData({ ...data, history:[] })} data-testid="button-clear-history"><Trash2 size={15}/> Effacer l'historique</button></PageTitle>{data.history.length ? <div className="space-y-3">{data.history.map(item=><div className="panel panel-hover flex flex-col gap-4 rounded-xl p-4 sm:flex-row sm:items-center sm:justify-between" key={item.id} data-testid={`row-history-${item.id}`}><div className="flex items-start gap-3"><div className="mt-1 rounded-md bg-[hsl(var(--cyan)/.1)] p-2 text-[hsl(var(--cyan))]"><History size={16}/></div><div><div className="font-semibold">{item.query}</div><div className="code mt-1 text-[10px] text-[hsl(var(--soft))]">{new Date(item.date).toLocaleString('fr-FR')} Â· {item.results} résultat{item.results > 1 ? 's' : ''} démo</div></div></div><button className="btn self-start text-xs sm:self-auto" onClick={()=>rerun(item.query)} data-testid={`button-rerun-${item.id}`}><Play size={13}/> Relancer</button></div>)}</div> : <div className="panel rounded-xl px-6 py-16 text-center"><History size={30} className="mx-auto mb-3 text-[hsl(var(--soft))]"/><h2 className="display text-lg font-bold">Le journal est encore vide</h2><p className="mt-2 text-sm text-[hsl(var(--soft))]">Lancez votre première recherche démo depuis la console.</p><Link href="/" className="btn btn-primary mt-5" data-testid="link-go-console">Ouvrir la console</Link></div>}</div>; }
function FavoritesPage() { const { data } = usenexus(); const favorites = listings.filter(x=>data.favorites.includes(x.id)); return <div className="mx-auto max-w-[1000px]"><PageTitle eyebrow="Votre shortlist locale" title="Favoris"><span className="code text-xs text-[hsl(var(--soft))]">{favorites.length} machine{favorites.length !== 1 ? 's' : ''} conservée{favorites.length !== 1 ? 's' : ''}</span></PageTitle>{favorites.length ? <div className="space-y-3">{favorites.map(item=><ListingCard key={item.id} item={item}/>)}</div> : <div className="panel rounded-xl px-6 py-16 text-center"><Heart size={30} className="mx-auto mb-3 text-[hsl(var(--soft))]"/><h2 className="display text-lg font-bold">Aucun favori pour le moment</h2><p className="mt-2 text-sm text-[hsl(var(--soft))]">Utilisez le cÅ“ur sur une annonce pour la garder sous la main.</p><Link href="/" className="btn btn-primary mt-5" data-testid="link-discover-listings">Découvrir les annonces</Link></div>}</div>; }

function NotificationsPage() { const { data, setData, installEvent, setInstallEvent, offline } = usenexus(); const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() => 'Notification' in window ? Notification.permission : 'unsupported'); const [sent, setSent] = useState(false); const enable = async () => { const value = await askNotificationPermission(); setPermission(value); if (value === 'granted') setData({ ...data, notifications:{ ...data.notifications, enabled:true } }); }; const send = async () => { const ok = await testNotification(); if (ok) { setSent(true); window.setTimeout(()=>setSent(false), 2000); } }; const install = async () => { if (!installEvent) return; const prompt = installEvent as BeforeInstallPromptEvent; await prompt.prompt(); setInstallEvent(null); }; return <div className="mx-auto max-w-[1000px]"><PageTitle eyebrow="Système / préférences" title="Alertes & installation"><span className="code text-xs text-[hsl(var(--soft))]">Persistance locale active</span></PageTitle><div className="grid gap-5 md:grid-cols-2"><div className="panel rounded-xl p-5 sm:p-6"><SectionHeading icon={Bell} title="Notifications navigateur" detail="Optionnelles, jamais silencieuses"/><div className="mt-6 flex items-center justify-between border-b border-[hsl(var(--line))] pb-5"><div><div className="font-semibold">Ã‰tat de permission</div><div className={`code mt-1 text-[10px] uppercase ${permission === 'granted' ? 'text-[hsl(var(--lime))]' : permission === 'denied' ? 'text-[hsl(var(--red))]' : 'text-[hsl(var(--soft))]'}`}>{permission === 'granted' ? 'Autorisé' : permission === 'denied' ? 'Refusé par le navigateur' : permission === 'unsupported' ? 'Non supporté' : 'Pas encore demandé'}</div></div>{permission === 'granted' ? <Check className="text-[hsl(var(--lime))]"/> : <button className="btn btn-primary text-xs" onClick={enable} disabled={permission === 'unsupported'} data-testid="button-request-notification">Autoriser</button>}</div><div className="flex items-center justify-between border-b border-[hsl(var(--line))] py-5"><div><div className="font-semibold">Prompt quotidien</div><div className="mt-1 text-xs text-[hsl(var(--soft))]">Un rappel local pour nourrir la veille</div></div><Toggle checked={data.notifications.daily} onChange={v=>setData({ ...data, notifications:{ ...data.notifications, daily:v } })} label="Activer le prompt quotidien"/></div><div className="flex items-center justify-between py-5"><div><div className="font-semibold">Heure du rappel</div><div className="mt-1 text-xs text-[hsl(var(--soft))]">Le navigateur décide du moment exact en mode démo</div></div><input className="field w-28" type="time" value={data.notifications.time} onChange={e=>setData({ ...data, notifications:{ ...data.notifications, time:e.target.value } })} data-testid="input-reminder-time"/></div><button className="btn w-full" onClick={send} disabled={permission !== 'granted'} data-testid="button-test-notification"><Radio size={15}/>{sent ? 'Notification envoyée' : 'Tester une notification locale'}</button></div><div className="space-y-5"><div className="panel rounded-xl p-5 sm:p-6"><SectionHeading icon={PackageOpen} title="Application installable" detail="PWA / cache hors ligne"/><div className="mt-6 flex items-center gap-3 rounded-lg border border-[hsl(var(--line))] bg-[hsl(var(--bg)/.4)] p-3"><div className={`grid h-9 w-9 place-items-center rounded-lg ${offline ? 'bg-[hsl(var(--amber)/.12)] text-[hsl(var(--amber))]' : 'bg-[hsl(var(--lime)/.12)] text-[hsl(var(--lime))]'}`}>{offline ? <CloudOff size={17}/> : <Wifi size={17}/>}</div><div><div className="text-sm font-semibold">{offline ? 'Fonctionne hors ligne' : 'Cache local disponible'}</div><div className="code mt-1 text-[9px] uppercase tracking-wider text-[hsl(var(--soft))]">{offline ? 'Aucune connexion requise' : 'Service worker enregistré'}</div></div></div>{installEvent ? <button className="btn btn-primary mt-4 w-full" onClick={install} data-testid="button-install-app"><DownloadIcon/> Installer NEXUS</button> : <div className="mt-4 rounded-lg border border-[hsl(var(--line))] p-3 text-xs leading-5 text-[hsl(var(--soft))]">L'installation apparaÃ®tra ici si votre navigateur la propose. Sur mobile, utilisez le menu du navigateur puis Â« Ajouter Ã  l'écran d'accueil Â».</div>}</div><div className="panel rounded-xl p-5 sm:p-6"><SectionHeading icon={ShieldCheck} title="Confidentialité du prototype" detail="Une limite claire"/><p className="mt-4 text-sm leading-6 text-[hsl(var(--soft))]">Les préférences, favoris et historiques restent dans le localStorage. Pas de compte, pas de scraping, pas de CAPTCHA contourné, pas de secret embarqué.</p></div></div></div></div>; }
function SectionHeading({ icon: Icon, title, detail }: { icon: typeof Bell; title:string; detail:string }) { return <div className="flex items-start gap-3"><div className="rounded-lg bg-[hsl(var(--cyan)/.1)] p-2 text-[hsl(var(--cyan))]"><Icon size={18}/></div><div><h2 className="display font-bold">{title}</h2><div className="code mt-1 text-[9px] uppercase tracking-widest text-[hsl(var(--soft))]">{detail}</div></div></div>; }
function Toggle({ checked, onChange, label }: { checked:boolean; onChange:(v:boolean)=>void; label:string }) { return <button className={`relative h-6 w-11 rounded-full border transition ${checked ? 'border-[hsl(var(--cyan))] bg-[hsl(var(--cyan)/.35)]' : 'border-[hsl(var(--line))] bg-[hsl(var(--bg))]'}`} onClick={()=>onChange(!checked)} aria-label={label} data-testid="toggle-setting"><span className={`absolute top-1 h-4 w-4 rounded-full transition-transform ${checked ? 'translate-x-5 bg-[hsl(var(--cyan))]' : 'translate-x-1 bg-[hsl(var(--soft))]'}`}/></button>; }
function DownloadIcon() { return <ExternalLink size={15}/>; }
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> };

export default App;









