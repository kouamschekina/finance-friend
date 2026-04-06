import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import type { Transaction, Category, SavingsGoal, UserProfile } from './finance-store';
import { getFilteredTransactions, formatCurrency } from './finance-store';

// Color palette for branding
const COLORS = {
  primary: [79, 70, 229] as [number, number, number], // Indigo
  secondary: [99, 102, 241] as [number, number, number],
  accent: [16, 185, 129] as [number, number, number], // Emerald
  danger: [239, 68, 68] as [number, number, number],
  warning: [245, 158, 11] as [number, number, number],
  text: [31, 41, 55] as [number, number, number],
  muted: [107, 114, 128] as [number, number, number],
  light: [243, 244, 246] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

interface ReportData {
  transactions: Transaction[];
  categories: Category[];
  goals: SavingsGoal[];
  profile: UserProfile;
  dateRange: { from: string; to: string };
}

interface FinancialStats {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  savingsRate: number;
  avgDailyExpense: number;
  avgDailyIncome: number;
  transactionCount: number;
  incomeCount: number;
  expenseCount: number;
  largestExpense: Transaction | null;
  largestIncome: Transaction | null;
}

interface CategoryStats {
  name: string;
  spent: number;
  budget: number;
  percentage: number;
  transactionCount: number;
  avgTransaction: number;
}

interface MonthlyTrend {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

function calculateFinancialStats(transactions: Transaction[]): FinancialStats {
  const income = transactions.filter(t => t.type === 'income');
  const expenses = transactions.filter(t => t.type === 'expense');
  
  const totalIncome = income.reduce((s, t) => s + t.amount, 0);
  const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0);
  
  const sortedExpenses = [...expenses].sort((a, b) => b.amount - a.amount);
  const sortedIncome = [...income].sort((a, b) => b.amount - a.amount);
  
  const dates = transactions.map(t => new Date(t.date).getTime());
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const days = transactions.length > 0 
    ? Math.max(1, Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)))
    : 1;
  
  return {
    totalIncome,
    totalExpenses,
    netBalance: totalIncome - totalExpenses,
    savingsRate: totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0,
    avgDailyExpense: totalExpenses / days,
    avgDailyIncome: totalIncome / days,
    transactionCount: transactions.length,
    incomeCount: income.length,
    expenseCount: expenses.length,
    largestExpense: sortedExpenses[0] || null,
    largestIncome: sortedIncome[0] || null,
  };
}

function calculateCategoryStats(transactions: Transaction[], categories: Category[]): CategoryStats[] {
  const expenses = transactions.filter(t => t.type === 'expense');
  const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0);
  
  const categoryMap = new Map<string, { spent: number; count: number }>();
  
  expenses.forEach(t => {
    const current = categoryMap.get(t.category) || { spent: 0, count: 0 };
    categoryMap.set(t.category, {
      spent: current.spent + t.amount,
      count: current.count + 1,
    });
  });
  
  const result: CategoryStats[] = [];
  
  categoryMap.forEach((data, name) => {
    const category = categories.find(c => c.name === name);
    result.push({
      name,
      spent: data.spent,
      budget: category?.budget_limit || 0,
      percentage: totalExpenses > 0 ? (data.spent / totalExpenses) * 100 : 0,
      transactionCount: data.count,
      avgTransaction: data.spent / data.count,
    });
  });
  
  return result.sort((a, b) => b.spent - a.spent);
}

function calculateMonthlyTrends(transactions: Transaction[]): MonthlyTrend[] {
  const monthlyData = new Map<string, { income: number; expenses: number }>();
  
  transactions.forEach(t => {
    const month = format(new Date(t.date), 'MMM yyyy');
    const current = monthlyData.get(month) || { income: 0, expenses: 0 };
    if (t.type === 'income') {
      current.income += t.amount;
    } else {
      current.expenses += t.amount;
    }
    monthlyData.set(month, current);
  });
  
  const result: MonthlyTrend[] = [];
  monthlyData.forEach((data, month) => {
    result.push({
      month,
      income: data.income,
      expenses: data.expenses,
      net: data.income - data.expenses,
    });
  });
  
  return result.sort((a, b) => {
    const dateA = new Date(a.month);
    const dateB = new Date(b.month);
    return dateA.getTime() - dateB.getTime();
  });
}

function getInsights(stats: FinancialStats, categoryStats: CategoryStats[], goals: SavingsGoal[]): string[] {
  const insights: string[] = [];
  
  // Savings rate insights
  if (stats.savingsRate >= 20) {
    insights.push(`Excellent savings rate of ${stats.savingsRate.toFixed(1)}%! You're on track for building wealth.`);
  } else if (stats.savingsRate >= 10) {
    insights.push(`Good savings rate of ${stats.savingsRate.toFixed(1)}%. Consider increasing to 20% for faster wealth building.`);
  } else if (stats.savingsRate > 0) {
    insights.push(`Your savings rate is ${stats.savingsRate.toFixed(1)}%. Try to increase it gradually for better financial security.`);
  } else {
    insights.push(`Warning: You're spending more than you earn. Review your expenses to find areas to cut back.`);
  }
  
  // Spending insights
  if (categoryStats.length > 0) {
    const topCategory = categoryStats[0];
    insights.push(`Your highest spending category is "${topCategory.name}" at ${topCategory.percentage.toFixed(1)}% of total expenses.`);
    
    if (topCategory.budget > 0 && topCategory.spent > topCategory.budget) {
      const overage = ((topCategory.spent - topCategory.budget) / topCategory.budget) * 100;
      insights.push(`You exceeded your "${topCategory.name}" budget by ${overage.toFixed(1)}%. Consider adjusting your spending or budget.`);
    }
  }
  
  // Transaction frequency
  if (stats.expenseCount > 0) {
    insights.push(`You made ${stats.expenseCount} expense transactions with an average of ${formatCurrency(stats.totalExpenses / stats.expenseCount, 'XAF')} per transaction.`);
  }
  
  // Goals insights
  const activeGoals = goals.filter(g => g.target_amount > 0);
  if (activeGoals.length > 0) {
    const totalGoalProgress = activeGoals.reduce((s, g) => s + (g.current_amount / g.target_amount) * 100, 0) / activeGoals.length;
    insights.push(`You have ${activeGoals.length} savings goal(s) with an average progress of ${totalGoalProgress.toFixed(1)}%.`);
    
    const nearestGoal = activeGoals.sort((a, b) => {
      const progressA = a.current_amount / a.target_amount;
      const progressB = b.current_amount / b.target_amount;
      return progressB - progressA;
    })[0];
    
    if (nearestGoal) {
      const progress = (nearestGoal.current_amount / nearestGoal.target_amount) * 100;
      insights.push(`Closest goal: "${nearestGoal.name}" at ${progress.toFixed(1)}% completion.`);
    }
  }
  
  // Net balance insight
  if (stats.netBalance > 0) {
    insights.push(`Positive net balance of ${formatCurrency(stats.netBalance, 'XAF')} this period. Great job managing your finances!`);
  } else if (stats.netBalance < 0) {
    insights.push(`Negative net balance of ${formatCurrency(Math.abs(stats.netBalance), 'XAF')}. Focus on reducing expenses or increasing income.`);
  }
  
  return insights;
}

function addHeader(doc: jsPDF, title: string, y: number): number {
  doc.setFillColor(...COLORS.primary);
  doc.rect(15, y, doc.internal.pageSize.getWidth() - 30, 8, 'F');
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 20, y + 5.5);
  doc.setTextColor(...COLORS.text);
  return y + 14;
}

function addFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Generated by Fenowa | Page ${pageNum} of ${totalPages}`,
    doc.internal.pageSize.getWidth() / 2,
    pageHeight - 10,
    { align: 'center' }
  );
}

export async function generateFinancialReport(data: ReportData): Promise<void> {
  const { transactions, categories, goals, profile, dateRange } = data;
  
  const fromDate = new Date(dateRange.from);
  const toDate = new Date(dateRange.to);
  
  const filteredTransactions = getFilteredTransactions(
    transactions,
    dateRange.from,
    dateRange.to
  );
  
  const stats = calculateFinancialStats(filteredTransactions);
  const categoryStats = calculateCategoryStats(filteredTransactions, categories);
  const monthlyTrends = calculateMonthlyTrends(filteredTransactions);
  const insights = getInsights(stats, categoryStats, goals);
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let y = 20;
  
  // ===== COVER PAGE =====
  // Logo area with gradient effect
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 80, 'F');
  
  // Logo circle
  doc.setFillColor(...COLORS.white);
  doc.circle(pageWidth / 2, 45, 20, 'F');
  doc.setFillColor(...COLORS.primary);
  doc.circle(pageWidth / 2, 45, 16, 'F');
  
  // Logo text
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('F', pageWidth / 2, 50, { align: 'center' });
  
  // Title
  doc.setFontSize(28);
  doc.text('Fenowa', pageWidth / 2, 100, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.muted);
  doc.setFont('helvetica', 'normal');
  doc.text('Financial Report', pageWidth / 2, 112, { align: 'center' });
  
  // Report details box
  doc.setFillColor(...COLORS.light);
  doc.roundedRect(margin, 130, pageWidth - margin * 2, 60, 5, 5, 'F');
  
  doc.setTextColor(...COLORS.text);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Report Details', margin + 10, 145);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`User: ${profile.name || 'User'}`, margin + 10, 158);
  doc.text(`Currency: ${profile.currency}`, margin + 10, 168);
  doc.text(`Period: ${format(fromDate, 'MMMM d, yyyy')} - ${format(toDate, 'MMMM d, yyyy')}`, margin + 10, 178);
  doc.text(`Generated: ${format(new Date(), 'MMMM d, yyyy h:mm a')}`, pageWidth - margin - 10, 168, { align: 'right' });
  doc.text(`Transactions: ${stats.transactionCount}`, pageWidth - margin - 10, 178, { align: 'right' });
  
  // Decorative line
  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(0.5);
  doc.line(margin, 210, pageWidth - margin, 210);
  
  // Quick summary
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.text);
  doc.text('Quick Summary', margin, 225);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.muted);
  doc.text(`This report covers your financial activity with ${stats.transactionCount} transactions,`, margin, 238);
  doc.text(`a net balance of ${formatCurrency(stats.netBalance, profile.currency)}, and a savings rate of ${stats.savingsRate.toFixed(1)}%.`, margin, 248);
  
  addFooter(doc, 1, 5);
  
  // ===== PAGE 2: EXECUTIVE SUMMARY =====
  doc.addPage();
  y = 20;
  
  y = addHeader(doc, 'Executive Summary', y);
  
  // Overview cards
  const cardWidth = (pageWidth - margin * 2 - 15) / 4;
  const cards = [
    { label: 'Total Income', value: formatCurrency(stats.totalIncome, profile.currency), color: COLORS.accent },
    { label: 'Total Expenses', value: formatCurrency(stats.totalExpenses, profile.currency), color: COLORS.danger },
    { label: 'Net Balance', value: formatCurrency(stats.netBalance, profile.currency), color: stats.netBalance >= 0 ? COLORS.accent : COLORS.danger },
    { label: 'Savings Rate', value: `${stats.savingsRate.toFixed(1)}%`, color: COLORS.primary },
  ];
  
  cards.forEach((card, i) => {
    const x = margin + i * (cardWidth + 5);
    doc.setFillColor(...COLORS.light);
    doc.roundedRect(x, y, cardWidth, 30, 3, 3, 'F');
    
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.setFont('helvetica', 'bold');
    doc.text(card.label, x + 5, y + 10);
    
    doc.setFontSize(11);
    doc.setTextColor(...card.color);
    doc.setFont('helvetica', 'bold');
    doc.text(card.value, x + 5, y + 22);
  });
  
  y += 45;
  
  // Financial health indicator
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.text('Financial Health Score', margin, y);
  
  const healthScore = Math.min(100, Math.max(0, stats.savingsRate + 50));
  const healthColor = healthScore >= 70 ? COLORS.accent : healthScore >= 40 ? COLORS.warning : COLORS.danger;
  
  // Progress bar
  doc.setFillColor(...COLORS.light);
  doc.roundedRect(margin, y + 5, pageWidth - margin * 2, 12, 3, 3, 'F');
  doc.setFillColor(...healthColor);
  doc.roundedRect(margin, y + 5, (pageWidth - margin * 2) * (healthScore / 100), 12, 3, 3, 'F');
  
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.white);
  doc.text(`${healthScore.toFixed(0)}%`, margin + (pageWidth - margin * 2) * (healthScore / 100) - 10, y + 13);
  
  y += 30;
  
  // Key metrics table
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.text('Key Metrics', margin, y);
  
  autoTable(doc, {
    startY: y + 5,
    head: [['Metric', 'Value']],
    body: [
      ['Total Transactions', stats.transactionCount.toString()],
      ['Income Transactions', stats.incomeCount.toString()],
      ['Expense Transactions', stats.expenseCount.toString()],
      ['Average Daily Income', formatCurrency(stats.avgDailyIncome, profile.currency)],
      ['Average Daily Expense', formatCurrency(stats.avgDailyExpense, profile.currency)],
      ['Largest Expense', stats.largestExpense ? `${stats.largestExpense.description || stats.largestExpense.category} (${formatCurrency(stats.largestExpense.amount, profile.currency)})` : 'N/A'],
      ['Largest Income', stats.largestIncome ? `${stats.largestIncome.description || stats.largestIncome.category} (${formatCurrency(stats.largestIncome.amount, profile.currency)})` : 'N/A'],
    ],
    theme: 'grid',
    headStyles: { fillColor: COLORS.primary, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: pageWidth - margin * 2 - 80 },
    },
    margin: { left: margin, right: margin },
  });
  
  y = (doc as any).lastAutoTable.finalY + 15;
  
  // Insights
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.text('Key Insights', margin, y);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.muted);
  
  insights.slice(0, 4).forEach((insight, i) => {
    const lines = doc.splitTextToSize(`• ${insight}`, pageWidth - margin * 2);
    doc.text(lines, margin, y + 10 + i * 12);
  });
  
  addFooter(doc, 2, 5);
  
  // ===== PAGE 3: CATEGORY ANALYSIS =====
  doc.addPage();
  y = 20;
  
  y = addHeader(doc, 'Category Analysis', y);
  
  if (categoryStats.length > 0) {
    // Category breakdown table
    autoTable(doc, {
      startY: y,
      head: [['Category', 'Spent', 'Budget', '% of Total', 'Transactions', 'Avg. Txn']],
      body: categoryStats.map(c => [
        c.name,
        formatCurrency(c.spent, profile.currency),
        c.budget > 0 ? formatCurrency(c.budget, profile.currency) : '—',
        `${c.percentage.toFixed(1)}%`,
        c.transactionCount.toString(),
        formatCurrency(c.avgTransaction, profile.currency),
      ]),
      theme: 'grid',
      headStyles: { fillColor: COLORS.primary, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 35 },
        2: { cellWidth: 30 },
        3: { cellWidth: 25 },
        4: { cellWidth: 25 },
        5: { cellWidth: 35 },
      },
      margin: { left: margin, right: margin },
    });
    
    y = (doc as any).lastAutoTable.finalY + 15;
    
    // Top spending categories visualization
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.text);
    doc.setFont('helvetica', 'bold');
    doc.text('Top 5 Spending Categories', margin, y);
    
    const topCategories = categoryStats.slice(0, 5);
    topCategories.forEach((cat, i) => {
      const barY = y + 10 + i * 18;
      const barWidth = (pageWidth - margin * 2 - 60) * (cat.percentage / 100);
      
      // Category name
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.muted);
      doc.setFont('helvetica', 'normal');
      doc.text(cat.name, margin, barY + 5);
      
      // Bar background
      doc.setFillColor(...COLORS.light);
      doc.roundedRect(margin + 55, barY, pageWidth - margin * 2 - 60, 10, 2, 2, 'F');
      
      // Bar fill
      const colors = [COLORS.primary, COLORS.secondary, COLORS.accent, COLORS.warning, COLORS.danger];
      doc.setFillColor(...colors[i % colors.length]);
      doc.roundedRect(margin + 55, barY, barWidth, 10, 2, 2, 'F');
      
      // Percentage
      doc.setTextColor(...COLORS.text);
      doc.setFont('helvetica', 'bold');
      doc.text(`${cat.percentage.toFixed(1)}%`, pageWidth - margin - 5, barY + 7, { align: 'right' });
    });
    
    y += 110;
    
    // Budget vs Actual
    const overBudget = categoryStats.filter(c => c.budget > 0 && c.spent > c.budget);
    if (overBudget.length > 0) {
      doc.setFontSize(11);
      doc.setTextColor(...COLORS.danger);
      doc.setFont('helvetica', 'bold');
      doc.text('Over Budget Categories', margin, y);
      
      autoTable(doc, {
        startY: y + 5,
        head: [['Category', 'Budget', 'Spent', 'Over By', '% Over']],
        body: overBudget.map(c => [
          c.name,
          formatCurrency(c.budget, profile.currency),
          formatCurrency(c.spent, profile.currency),
          formatCurrency(c.spent - c.budget, profile.currency),
          `${(((c.spent - c.budget) / c.budget) * 100).toFixed(1)}%`,
        ]),
        theme: 'grid',
        headStyles: { fillColor: COLORS.danger, fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        margin: { left: margin, right: margin },
      });
    }
  } else {
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.muted);
    doc.text('No expense data available for the selected period.', margin, y + 10);
  }
  
  addFooter(doc, 3, 5);
  
  // ===== PAGE 4: TRANSACTION DETAILS =====
  doc.addPage();
  y = 20;
  
  y = addHeader(doc, 'Transaction Details', y);
  
  // Top 20 expenses
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.text('Top 20 Expenses', margin, y);
  
  const topExpenses = [...filteredTransactions]
    .filter(t => t.type === 'expense')
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 20);
  
  if (topExpenses.length > 0) {
    autoTable(doc, {
      startY: y + 5,
      head: [['Date', 'Description', 'Category', 'Method', 'Amount']],
      body: topExpenses.map(t => [
        format(new Date(t.date), 'MMM d'),
        t.description || '—',
        t.category,
        t.payment_method,
        `-${formatCurrency(t.amount, profile.currency)}`,
      ]),
      theme: 'grid',
      headStyles: { fillColor: COLORS.primary, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 55 },
        2: { cellWidth: 35 },
        3: { cellWidth: 30 },
        4: { cellWidth: 35 },
      },
      margin: { left: margin, right: margin },
    });
    
    y = (doc as any).lastAutoTable.finalY + 15;
  }
  
  // Top 10 income
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.text('Top 10 Income Transactions', margin, y);
  
  const topIncome = [...filteredTransactions]
    .filter(t => t.type === 'income')
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);
  
  if (topIncome.length > 0) {
    autoTable(doc, {
      startY: y + 5,
      head: [['Date', 'Description', 'Category', 'Method', 'Amount']],
      body: topIncome.map(t => [
        format(new Date(t.date), 'MMM d'),
        t.description || '—',
        t.category,
        t.payment_method,
        `+${formatCurrency(t.amount, profile.currency)}`,
      ]),
      theme: 'grid',
      headStyles: { fillColor: COLORS.accent, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 55 },
        2: { cellWidth: 35 },
        3: { cellWidth: 30 },
        4: { cellWidth: 35 },
      },
      margin: { left: margin, right: margin },
    });
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.text('No income transactions in this period.', margin, y + 10);
  }
  
  addFooter(doc, 4, 5);
  
  // ===== PAGE 5: GOALS & RECOMMENDATIONS =====
  doc.addPage();
  y = 20;
  
  y = addHeader(doc, 'Goals & Recommendations', y);
  
  // Goals progress
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.text('Savings Goals Progress', margin, y);
  
  if (goals.length > 0) {
    autoTable(doc, {
      startY: y + 5,
      head: [['Goal', 'Target', 'Current', 'Progress', 'Deadline']],
      body: goals.map(g => {
        const progress = g.target_amount > 0 ? (g.current_amount / g.target_amount) * 100 : 0;
        return [
          g.name,
          formatCurrency(g.target_amount, profile.currency),
          formatCurrency(g.current_amount, profile.currency),
          `${progress.toFixed(1)}%`,
          g.deadline ? format(new Date(g.deadline), 'MMM d, yyyy') : '—',
        ];
      }),
      theme: 'grid',
      headStyles: { fillColor: COLORS.primary, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      margin: { left: margin, right: margin },
    });
    
    y = (doc as any).lastAutoTable.finalY + 15;
    
    // Goals visualization
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.text);
    doc.setFont('helvetica', 'bold');
    doc.text('Goal Progress Visualization', margin, y);
    
    goals.slice(0, 5).forEach((goal, i) => {
      const barY = y + 10 + i * 20;
      const progress = goal.target_amount > 0 ? Math.min(100, (goal.current_amount / goal.target_amount) * 100) : 0;
      const barWidth = (pageWidth - margin * 2 - 60) * (progress / 100);
      
      // Goal name
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.muted);
      doc.setFont('helvetica', 'normal');
      doc.text(goal.name, margin, barY + 5);
      
      // Bar background
      doc.setFillColor(...COLORS.light);
      doc.roundedRect(margin + 55, barY, pageWidth - margin * 2 - 60, 12, 3, 3, 'F');
      
      // Bar fill
      const progressColor = progress >= 100 ? COLORS.accent : progress >= 50 ? COLORS.warning : COLORS.primary;
      doc.setFillColor(...progressColor);
      doc.roundedRect(margin + 55, barY, barWidth, 12, 3, 3, 'F');
      
      // Percentage
      doc.setTextColor(...COLORS.text);
      doc.setFont('helvetica', 'bold');
      doc.text(`${progress.toFixed(0)}%`, pageWidth - margin - 5, barY + 8, { align: 'right' });
    });
    
    y += 120;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.text('No savings goals set.', margin, y + 10);
    y += 20;
  }
  
  // Monthly trends
  if (monthlyTrends.length > 0) {
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.text);
    doc.setFont('helvetica', 'bold');
    doc.text('Monthly Trends', margin, y);
    
    autoTable(doc, {
      startY: y + 5,
      head: [['Month', 'Income', 'Expenses', 'Net']],
      body: monthlyTrends.map(m => [
        m.month,
        formatCurrency(m.income, profile.currency),
        formatCurrency(m.expenses, profile.currency),
        formatCurrency(m.net, profile.currency),
      ]),
      theme: 'grid',
      headStyles: { fillColor: COLORS.primary, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      margin: { left: margin, right: margin },
    });
    
    y = (doc as any).lastAutoTable.finalY + 15;
  }
  
  // Recommendations
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.text('Recommendations', margin, y);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.muted);
  
  const recommendations = [
    'Review your top spending categories monthly to identify areas for potential savings.',
    'Set up automatic transfers to your savings goals to ensure consistent progress.',
    'Track your expenses regularly to stay within budget limits.',
    'Consider building an emergency fund covering 3-6 months of expenses.',
    'Review and adjust your budgets based on your spending patterns.',
  ];
  
  recommendations.forEach((rec, i) => {
    const lines = doc.splitTextToSize(`${i + 1}. ${rec}`, pageWidth - margin * 2);
    doc.text(lines, margin, y + 10 + i * 14);
  });
  
  addFooter(doc, 5, 5);
  
  // Save the PDF
  const fileName = `Fenowa_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  doc.save(fileName);
}
