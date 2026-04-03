export const LOCALE_CODES = ['en', 'es', 'fr', 'de'] as const;
export type LocaleCode = (typeof LOCALE_CODES)[number];

export const DEFAULT_LOCALE: LocaleCode = 'en';

export const LOCALE_STORAGE_KEY = 'finwise-locale';

export function isLocaleCode(value: string): value is LocaleCode {
  return (LOCALE_CODES as readonly string[]).includes(value);
}

export const LOCALE_LABELS: Record<LocaleCode, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
};

/** Flat message keys used across the shell */
type MessageKey =
  | 'nav.home'
  | 'nav.transactions'
  | 'nav.budgets'
  | 'nav.goals'
  | 'page.dashboard'
  | 'page.transactions'
  | 'page.budgets'
  | 'page.goals'
  | 'page.profile'
  | 'page.advisor'
  | 'page.reports'
  | 'settings.title'
  | 'settings.appearance'
  | 'settings.language'
  | 'settings.account'
  | 'settings.advisor'
  | 'settings.groqKey'
  | 'settings.save'
  | 'settings.openChat'
  | 'settings.personalInfo'
  | 'transaction.new'
  | 'transaction.edit'
  | 'transaction.expense'
  | 'transaction.income'
  | 'transaction.category'
  | 'transaction.save'
  | 'landing.welcome'
  | 'landing.signin'
  | 'landing.google'
  | 'landing.later';

const catalog: Record<LocaleCode, Record<MessageKey, string>> = {
  en: {
    'nav.home': 'Home',
    'nav.transactions': 'Activity',
    'nav.budgets': 'Budgets',
    'nav.goals': 'Goals',
    'page.dashboard': 'Overview',
    'page.transactions': 'Transactions',
    'page.budgets': 'Budgets',
    'page.goals': 'Goals',
    'page.profile': 'Profile',
    'page.advisor': 'Advisor',
    'page.reports': 'Reports',
    'settings.title': 'Settings',
    'settings.appearance': 'Appearance',
    'settings.language': 'Language',
    'settings.account': 'Account',
    'settings.advisor': 'AI advisor',
    'settings.groqKey': 'Groq API key',
    'settings.save': 'Save',
    'settings.openChat': 'Open chat',
    'settings.personalInfo': 'Personal information',
    'transaction.new': 'New entry',
    'transaction.edit': 'Edit entry',
    'transaction.expense': 'Expense',
    'transaction.income': 'Income',
    'transaction.category': 'Category',
    'transaction.save': 'Save',
    'landing.welcome': 'Welcome to FinWise',
    'landing.signin': 'Please sign in to continue',
    'landing.google': 'Sign in with Google',
    'landing.later': 'Continue Later',
  },
  es: {
    'nav.home': 'Inicio',
    'nav.transactions': 'Movimientos',
    'nav.budgets': 'Presupuestos',
    'nav.goals': 'Metas',
    'page.dashboard': 'Resumen',
    'page.transactions': 'Movimientos',
    'page.budgets': 'Presupuestos',
    'page.goals': 'Metas',
    'page.profile': 'Perfil',
    'page.advisor': 'Asesor',
    'page.reports': 'Informes',
    'settings.title': 'Ajustes',
    'settings.appearance': 'Apariencia',
    'settings.language': 'Idioma',
    'settings.account': 'Cuenta',
    'settings.advisor': 'Asesor IA',
    'settings.groqKey': 'Clave API de Groq',
    'settings.save': 'Guardar',
    'settings.openChat': 'Abrir chat',
    'settings.personalInfo': 'Información personal',
    'transaction.new': 'Nuevo',
    'transaction.edit': 'Editar',
    'transaction.expense': 'Gasto',
    'transaction.income': 'Ingreso',
    'transaction.category': 'Categoría',
    'transaction.save': 'Guardar',
    'landing.welcome': 'Bienvenido a FinWise',
    'landing.signin': 'Inicia sesión para continuar',
    'landing.google': 'Continuar con Google',
    'landing.later': 'Continuar más tarde',
  },
  fr: {
    'nav.home': 'Accueil',
    'nav.transactions': 'Activité',
    'nav.budgets': 'Budgets',
    'nav.goals': 'Objectifs',
    'page.dashboard': 'Vue d’ensemble',
    'page.transactions': 'Transactions',
    'page.budgets': 'Budgets',
    'page.goals': 'Objectifs',
    'page.profile': 'Profil',
    'page.advisor': 'Conseiller',
    'page.reports': 'Rapports',
    'settings.title': 'Réglages',
    'settings.appearance': 'Apparence',
    'settings.language': 'Langue',
    'settings.account': 'Compte',
    'settings.advisor': 'Conseiller IA',
    'settings.groqKey': 'Clé API Groq',
    'settings.save': 'Enregistrer',
    'settings.openChat': 'Ouvrir le chat',
    'settings.personalInfo': 'Informations personnelles',
    'transaction.new': 'Nouvelle entrée',
    'transaction.edit': 'Modifier',
    'transaction.expense': 'Dépense',
    'transaction.income': 'Revenu',
    'transaction.category': 'Catégorie',
    'transaction.save': 'Enregistrer',
    'landing.welcome': 'Bienvenue sur FinWise',
    'landing.signin': 'Veuillez vous connecter pour continuer',
    'landing.google': 'Continuer avec Google',
    'landing.later': 'Continuer plus tard',
  },
  de: {
    'nav.home': 'Start',
    'nav.transactions': 'Aktivität',
    'nav.budgets': 'Budgets',
    'nav.goals': 'Ziele',
    'page.dashboard': 'Überblick',
    'page.transactions': 'Buchungen',
    'page.budgets': 'Budgets',
    'page.goals': 'Ziele',
    'page.profile': 'Profil',
    'page.advisor': 'Berater',
    'page.reports': 'Berichte',
    'settings.title': 'Einstellungen',
    'settings.appearance': 'Erscheinungsbild',
    'settings.language': 'Sprache',
    'settings.account': 'Konto',
    'settings.advisor': 'KI-Berater',
    'settings.groqKey': 'Groq-API-Schlüssel',
    'settings.save': 'Speichern',
    'settings.openChat': 'Chat öffnen',
    'settings.personalInfo': 'Persönliche Daten',
    'transaction.new': 'Neuer Eintrag',
    'transaction.edit': 'Bearbeiten',
    'transaction.expense': 'Ausgabe',
    'transaction.income': 'Einnahme',
    'transaction.category': 'Kategorie',
    'transaction.save': 'Speichern',
    'landing.welcome': 'Willkommen bei FinWise',
    'landing.signin': 'Bitte melden Sie sich an, um fortzufahren',
    'landing.google': 'Mit Google anmelden',
    'landing.later': 'Später fortfahren',
  },
};

export function translate(locale: LocaleCode, key: MessageKey): string {
  return catalog[locale][key] ?? catalog.en[key] ?? key;
}
