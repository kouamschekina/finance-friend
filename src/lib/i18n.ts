export const LOCALE_CODES = ['en', 'fr'] as const;
export type LocaleCode = (typeof LOCALE_CODES)[number];

export const DEFAULT_LOCALE: LocaleCode = 'en';

export const LOCALE_STORAGE_KEY = 'fenowa-locale';

export function isLocaleCode(value: string): value is LocaleCode {
  return (LOCALE_CODES as readonly string[]).includes(value);
}

export const LOCALE_LABELS: Record<LocaleCode, string> = {
  en: 'English',
  fr: 'Français',
};

/** Flat message keys used across the shell */
export type MessageKey =
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
  | 'transaction.linkGoal'
  | 'transaction.notePlaceholder'
  | 'transaction.payment'
  | 'transaction.none'
  | 'category.editBudget'
  | 'category.setBudget'
  | 'category.accountability'
  | 'category.selectCategory'
  | 'category.hint'
  | 'category.saveBudget'
  | 'goal.editTitle'
  | 'goal.createTitle'
  | 'goal.wealth'
  | 'goal.identity'
  | 'goal.namePlaceholder'
  | 'goal.targetDate'
  | 'goal.pickDeadline'
  | 'goal.saveChanges'
  | 'goal.launch'
  | 'goal.deleteConfirm'
  | 'notifications.title'
  | 'notifications.markAllRead'
  | 'notifications.markAsRead'
  | 'notifications.allCaughtUp'
  | 'notifications.allCaughtUpDesc'
  | 'notifications.viewDetails'
  | 'menu.title'
  | 'menu.exportPdf'
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
    'transaction.linkGoal': 'Link to Savings Goal',
    'transaction.notePlaceholder': 'Note (optional)',
    'transaction.payment': 'Payment',
    'transaction.none': 'None',
    'category.editBudget': 'Edit Budget',
    'category.setBudget': 'Set Budget Limit',
    'category.accountability': 'Accountability Flow',
    'category.selectCategory': 'Select Category',
    'category.hint': 'Select a category above and enter your monthly spending limit using the keypad.',
    'category.saveBudget': 'Save Budget Limit',
    'goal.editTitle': 'Edit Goal',
    'goal.createTitle': 'Create New Goal',
    'goal.wealth': 'Wealth Generator',
    'goal.identity': 'Goal Identity',
    'goal.namePlaceholder': 'e.g. New Car, Dream Wedding',
    'goal.targetDate': 'Target Date (Optional)',
    'goal.pickDeadline': 'Pick a deadline',
    'goal.saveChanges': 'Save Goal Changes',
    'goal.launch': 'Launch New Goal',
    'goal.deleteConfirm': 'Are you sure you want to delete this savings goal?',
    'notifications.title': 'Notifications',
    'notifications.markAllRead': 'Mark all as read',
    'notifications.markAsRead': 'Mark as read',
    'notifications.allCaughtUp': 'All caught up!',
    'notifications.allCaughtUpDesc': "When something important happens with your finances, we'll let you know.",
    'notifications.viewDetails': 'View details',
    'menu.title': 'Menu',
    'menu.exportPdf': 'Export PDF',
    'landing.welcome': 'Welcome to Fenowa',
    'landing.signin': 'Please sign in to continue',
    'landing.google': 'Sign in with Google',
    'landing.later': 'Continue Later',
  },
  fr: {
    'nav.home': 'Accueil',
    'nav.transactions': 'Activité',
    'nav.budgets': 'Budgets',
    'nav.goals': 'Objectifs',
    'page.dashboard': 'Vue d\'ensemble',
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
    'transaction.linkGoal': 'Lier à un Objectif d\'Épargne',
    'transaction.notePlaceholder': 'Note (optionnel)',
    'transaction.payment': 'Paiement',
    'transaction.none': 'Aucun',
    'category.editBudget': 'Modifier le Budget',
    'category.setBudget': 'Définir la Limite',
    'category.accountability': 'Flux de Responsabilité',
    'category.selectCategory': 'Sélectionner une Catégorie',
    'category.hint': 'Sélectionnez une catégorie ci-dessus et entrez votre limite mensuelle via le clavier.',
    'category.saveBudget': 'Enregistrer la Limite',
    'goal.editTitle': 'Modifier l\'Objectif',
    'goal.createTitle': 'Créer un Objectif',
    'goal.wealth': 'Générateur de Richesse',
    'goal.identity': 'Identité de l\'Objectif',
    'goal.namePlaceholder': 'ex. Nouvelle Voiture, Mariage de Rêve',
    'goal.targetDate': 'Date Cible (Optionnel)',
    'goal.pickDeadline': 'Choisir une échéance',
    'goal.saveChanges': 'Enregistrer les Modifications',
    'goal.launch': 'Lancer le Nouvel Objectif',
    'goal.deleteConfirm': 'Êtes-vous sûr de vouloir supprimer cet objectif d\'épargne ?',
    'notifications.title': 'Notifications',
    'notifications.markAllRead': 'Tout marquer comme lu',
    'notifications.markAsRead': 'Marquer comme lu',
    'notifications.allCaughtUp': 'Tout est à jour !',
    'notifications.allCaughtUpDesc': 'Quand quelque chose d\'important arrive avec vos finances, nous vous le ferons savoir.',
    'notifications.viewDetails': 'Voir les détails',
    'menu.title': 'Menu',
    'menu.exportPdf': 'Exporter PDF',
    'landing.welcome': 'Bienvenue sur Fenowa',
    'landing.signin': 'Veuillez vous connecter pour continuer',
    'landing.google': 'Continuer avec Google',
    'landing.later': 'Continuer plus tard',
  },
};

export function translate(locale: LocaleCode, key: MessageKey): string {
  return catalog[locale][key] ?? catalog.en[key] ?? key;
}
