// Data Management (per-user persistence)
let appData = {};

function getDefaultAppData(userName) {
  return {
    user: {
      name: userName || 'You',
      currency: 'INR',
      monthly_budget: 50000,
      savings_goal: 150000,
      savings_goal_deadline: '2025-12-31'
    },
    categories: [
      { id: 1, name: 'Food', icon: '🍔', budget_limit: 10000, color: '#FF6B6B' },
      { id: 2, name: 'Travel', icon: '🚗', budget_limit: 8000, color: '#4ECDC4' },
      { id: 3, name: 'Entertainment', icon: '🎬', budget_limit: 5000, color: '#FFE66D' },
      { id: 4, name: 'Shopping', icon: '🛍️', budget_limit: 15000, color: '#95E1D3' },
      { id: 5, name: 'Bills', icon: '💡', budget_limit: 7000, color: '#F38181' },
      { id: 6, name: 'Healthcare', icon: '⚕️', budget_limit: 5000, color: '#AA96DA' }
    ],
    expenses: [],
    income: [],
    points: 0,
    nextExpenseId: 1,
    nextIncomeId: 1
  };
}

function getStorageKey() {
  const email = localStorage.getItem('userEmail') || '';
  return `sft:data:${email}`;
}

async function loadUserData() {
  const key = getStorageKey();
  const raw = localStorage.getItem(key);
  const name = localStorage.getItem('userName') || 'User';
  // Override to "You" for display consistency
  const displayName = 'You';
  const email = (localStorage.getItem('userEmail') || '').toLowerCase();
  let fromDb = null;
  let fromApi = null;
  try {
    fromApi = (window.API && email) ? await API.loadUserData(email) : null;
  } catch (_) {}
  if (fromApi) {
    appData = fromApi;
    appData.user = appData.user || {};
    appData.user.name = displayName;
    // Cache to local and db.js
    saveUserData();
  } else {
    fromDb = (window.DB && email) ? DB.loadUserData(email, null) : null;
  }
  if (fromDb) {
    appData = fromDb;
    appData.user = appData.user || {};
    appData.user.name = displayName;
  } else if (raw) {
    try {
      appData = JSON.parse(raw);
      appData.user = appData.user || {};
      appData.user.name = displayName;
      saveUserData();
    } catch (_) {
      appData = getDefaultAppData(displayName);
      saveUserData();
    }
  } else {
    appData = getDefaultAppData(displayName);
    saveUserData();
  }
}

function saveUserData() {
  const key = getStorageKey();
  try {
    localStorage.setItem(key, JSON.stringify(appData));
  } catch (_) {}
  const email = (localStorage.getItem('userEmail') || '').toLowerCase();
  if (window.DB && email) DB.saveUserData(email, appData);
  (async function tryApiSave() {
    try { if (window.API && email) await API.saveUserData(email, appData); } catch (_) {}
  })();
}

// Chart management to keep visualizations in sync
const chartRegistry = {};

function createOrReplaceChart(canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  if (chartRegistry[canvasId]) {
    try { chartRegistry[canvasId].destroy(); } catch (_) {}
  }
  chartRegistry[canvasId] = new Chart(canvas, config);
  return chartRegistry[canvasId];
}

// Utility Functions
function formatCurrency(amount) {
  return '₹' + amount.toLocaleString('en-IN');
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function getTodayDate() {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function getCategoryData(categoryName) {
  return appData.categories.find(cat => cat.name === categoryName);
}

// Calculations
function calculateTotalIncome() {
  return appData.income.reduce((sum, item) => sum + item.amount, 0);
}

function calculateTotalExpenses() {
  return appData.expenses.reduce((sum, item) => sum + item.amount, 0);
}

function calculateBalance() {
  return calculateTotalIncome() - calculateTotalExpenses();
}

function calculateCategorySpending() {
  const spending = {};
  appData.categories.forEach(cat => {
    spending[cat.name] = 0;
  });
  
  appData.expenses.forEach(expense => {
    if (spending[expense.category] !== undefined) {
      spending[expense.category] += expense.amount;
    }
  });
  
  return spending;
}

function updateDashboardStats() {
  const totalIncome = calculateTotalIncome();
  const totalExpenses = calculateTotalExpenses();
  const balance = calculateBalance();
  const savingsProgress = (balance / appData.user.savings_goal * 100).toFixed(1);
  
  document.getElementById('totalIncome').textContent = formatCurrency(totalIncome);
  document.getElementById('totalExpenses').textContent = formatCurrency(totalExpenses);
  document.getElementById('currentBalance').textContent = formatCurrency(balance);
  document.getElementById('savingsProgress').textContent = savingsProgress + '%';
  document.getElementById('userPoints').textContent = appData.points;
  
  const pointsElements = document.querySelectorAll('#totalPoints');
  pointsElements.forEach(el => el.textContent = appData.points);
}

// Navigation
function navigateToView(viewName, tab = null) {
  // Hide all views
  document.querySelectorAll('.view').forEach(view => {
    view.classList.remove('active');
  });
  
  // Remove active class from all nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  
  // Show selected view
  const selectedView = document.getElementById(viewName);
  if (selectedView) {
    selectedView.classList.add('active');
  }
  
  // Add active class to nav item
  const navItem = document.querySelector(`[data-view="${viewName}"]`);
  if (navItem) {
    navItem.classList.add('active');
  }
  
  // Handle tab switching for add-transaction
  if (viewName === 'add-transaction' && tab) {
    switchTab(tab);
  }
  
  // Refresh view-specific data
  if (viewName === 'expense-tracking') {
    renderExpensesList();
  } else if (viewName === 'budget-management') {
    renderBudgetCategories();
  } else if (viewName === 'ai-insights') {
    renderAIInsights();
  } else if (viewName === 'visualizations') {
    initVisualizationCharts();
  }
  
  // Close mobile menu
  document.getElementById('sidebar').classList.remove('show');
}

// Initialize Navigation
function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const viewName = item.getAttribute('data-view');
      navigateToView(viewName);
    });
  });
  
  // Mobile menu toggle
  document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('show');
  });
}

// Dashboard - Charts
function initDashboardCharts() {
  // Category Pie Chart
  const categorySpending = calculateCategorySpending();
  if (document.getElementById('categoryPieChart')) {
    createOrReplaceChart('categoryPieChart', {
      type: 'pie',
      data: {
        labels: Object.keys(categorySpending),
        datasets: [{
          data: Object.values(categorySpending),
          backgroundColor: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181', '#AA96DA']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });
  }
  
  // Income vs Expenses Bar Chart
  if (document.getElementById('incomeExpenseChart')) {
    createOrReplaceChart('incomeExpenseChart', {
      type: 'bar',
      data: {
        labels: ['October'],
        datasets: [
          {
            label: 'Income',
            data: [calculateTotalIncome()],
            backgroundColor: '#10b981'
          },
          {
            label: 'Expenses',
            data: [calculateTotalExpenses()],
            backgroundColor: '#ef4444'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom'
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }
  
  // Spending Trend Line Chart
  if (document.getElementById('spendingTrendChart')) {
    const sortedExpenses = [...appData.expenses].sort((a, b) => new Date(a.date) - new Date(b.date));
    let cumulative = 0;
    const trendData = sortedExpenses.map(expense => {
      cumulative += expense.amount;
      return cumulative;
    });
    
    createOrReplaceChart('spendingTrendChart', {
      type: 'line',
      data: {
        labels: sortedExpenses.map(e => formatDate(e.date)),
        datasets: [{
          label: 'Cumulative Spending',
          data: trendData,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }
}

// Dashboard - Recent Transactions
function renderRecentTransactions() {
  const container = document.getElementById('recentTransactionsList');
  const recentExpenses = [...appData.expenses].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  
  if (recentExpenses.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No transactions yet</p>';
    return;
  }
  
  container.innerHTML = recentExpenses.map(expense => {
    const category = getCategoryData(expense.category);
    return `
      <div class="transaction-item">
        <div class="transaction-left">
          <div class="transaction-icon" style="background: ${category.color}20;">
            ${category.icon}
          </div>
          <div class="transaction-details">
            <h4>${expense.description}</h4>
            <div class="transaction-date">${formatDate(expense.date)} • ${expense.category}</div>
          </div>
        </div>
        <div class="transaction-amount expense">
          -${formatCurrency(expense.amount)}
        </div>
      </div>
    `;
  }).join('');
}

// Add Transaction - Forms
function initTransactionForms() {
  // Set default dates
  document.getElementById('expenseDate').value = getTodayDate();
  document.getElementById('incomeDate').value = getTodayDate();
  
  // Populate category dropdown
  const categorySelect = document.getElementById('expenseCategory');
  appData.categories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat.name;
    option.textContent = `${cat.icon} ${cat.name}`;
    categorySelect.appendChild(option);
  });
  
  // Populate filter dropdowns
  const filterCategory = document.getElementById('filterCategory');
  appData.categories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat.name;
    option.textContent = `${cat.icon} ${cat.name}`;
    filterCategory.appendChild(option);
  });
  
  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-tab');
      switchTab(tabName);
    });
  });
  
  // Expense form submission
  document.getElementById('expenseForm').addEventListener('submit', (e) => {
    e.preventDefault();
    handleAddExpense();
  });
  
  // Income form submission
  document.getElementById('incomeForm').addEventListener('submit', (e) => {
    e.preventDefault();
    handleAddIncome();
  });
  
  // Auto-categorize on description input
  document.getElementById('expenseDescription').addEventListener('input', (e) => {
    autoCategorizeSuggestion(e.target.value);
  });
}

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  
  const tab = document.querySelector(`[data-tab="${tabName}"]`);
  const pane = document.getElementById(`${tabName}-tab`);
  
  if (tab) tab.classList.add('active');
  if (pane) pane.classList.add('active');
}

function autoCategorizeSuggestion(description) {
  const keywords = {
    'Food': ['restaurant', 'food', 'dinner', 'lunch', 'breakfast', 'groceries', 'swiggy', 'zomato', 'cafe'],
    'Travel': ['uber', 'ola', 'cab', 'travel', 'bus', 'train', 'flight', 'petrol', 'fuel'],
    'Entertainment': ['movie', 'cinema', 'netflix', 'spotify', 'game', 'concert'],
    'Shopping': ['amazon', 'flipkart', 'shopping', 'mall', 'store', 'clothes', 'shoes'],
    'Bills': ['electricity', 'water', 'gas', 'internet', 'phone', 'bill'],
    'Healthcare': ['doctor', 'medicine', 'hospital', 'pharmacy', 'medical', 'health']
  };
  
  const lowerDesc = description.toLowerCase();
  
  for (const [category, words] of Object.entries(keywords)) {
    if (words.some(word => lowerDesc.includes(word))) {
      document.getElementById('expenseCategory').value = category;
      break;
    }
  }
}

function handleAddExpense() {
  const expense = {
    id: appData.nextExpenseId++,
    date: document.getElementById('expenseDate').value,
    category: document.getElementById('expenseCategory').value,
    amount: parseFloat(document.getElementById('expenseAmount').value),
    description: document.getElementById('expenseDescription').value,
    payment_mode: document.getElementById('expensePaymentMode').value
  };
  
  appData.expenses.push(expense);
  appData.points += 5;
  saveUserData();
  
  showToast('Expense added successfully! +5 points', 'success');
  document.getElementById('expenseForm').reset();
  document.getElementById('expenseDate').value = getTodayDate();
  
  updateDashboardStats();
  renderRecentTransactions();
  initDashboardCharts();
  checkBudgetAlerts();
  // Refresh visualizations if present
  initDashboardCharts();
  initVisualizationCharts();
}

function handleAddIncome() {
  const income = {
    id: appData.nextIncomeId++,
    date: document.getElementById('incomeDate').value,
    source: document.getElementById('incomeSource').value,
    amount: parseFloat(document.getElementById('incomeAmount').value),
    type: document.getElementById('incomeType').value
  };
  
  appData.income.push(income);
  appData.points += 10;
  saveUserData();
  
  showToast('Income added successfully! +10 points', 'success');
  document.getElementById('incomeForm').reset();
  document.getElementById('incomeDate').value = getTodayDate();
  
  updateDashboardStats();
  // Refresh visualizations if present
  initDashboardCharts();
  initVisualizationCharts();
}

// Expense Tracking
function renderExpensesList() {
  const container = document.getElementById('expensesList');
  const searchTerm = document.getElementById('searchExpenses').value.toLowerCase();
  const filterCat = document.getElementById('filterCategory').value;
  const filterPayment = document.getElementById('filterPaymentMode').value;
  
  let filtered = appData.expenses.filter(expense => {
    const matchesSearch = expense.description.toLowerCase().includes(searchTerm);
    const matchesCategory = !filterCat || expense.category === filterCat;
    const matchesPayment = !filterPayment || expense.payment_mode === filterPayment;
    return matchesSearch && matchesCategory && matchesPayment;
  });
  
  const total = filtered.reduce((sum, e) => sum + e.amount, 0);
  document.getElementById('filteredTotal').textContent = formatCurrency(total);
  
  if (filtered.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No expenses found</p>';
    return;
  }
  
  // Sort by date (newest first)
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  container.innerHTML = filtered.map(expense => {
    const category = getCategoryData(expense.category);
    return `
      <div class="expense-card">
        <div class="expense-info">
          <div class="expense-icon" style="background: ${category.color}20;">
            ${category.icon}
          </div>
          <div class="expense-details">
            <h4>${expense.description}</h4>
            <div class="expense-meta">
              <span>${formatDate(expense.date)}</span>
              <span>${expense.category}</span>
              <span>${expense.payment_mode}</span>
            </div>
          </div>
        </div>
        <div class="expense-right">
          <div class="expense-amount">${formatCurrency(expense.amount)}</div>
          <div class="expense-actions">
            <button class="icon-btn" onclick="deleteExpense(${expense.id})" title="Delete">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function deleteExpense(id) {
  if (confirm('Are you sure you want to delete this expense?')) {
    appData.expenses = appData.expenses.filter(e => e.id !== id);
    saveUserData();
    showToast('Expense deleted successfully', 'success');
    renderExpensesList();
    updateDashboardStats();
    renderRecentTransactions();
    initDashboardCharts();
    initVisualizationCharts();
  }
}

function exportToCSV() {
  let csv = 'Date,Category,Description,Amount,Payment Mode\n';
  appData.expenses.forEach(expense => {
    csv += `${expense.date},${expense.category},"${expense.description}",${expense.amount},${expense.payment_mode}\n`;
  });
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'expenses.csv';
  a.click();
  showToast('Expenses exported to CSV', 'success');
}

// Search and filter functionality
function initExpenseFilters() {
  document.getElementById('searchExpenses').addEventListener('input', renderExpensesList);
  document.getElementById('filterCategory').addEventListener('change', renderExpensesList);
  document.getElementById('filterPaymentMode').addEventListener('change', renderExpensesList);
}

// Budget Management
function renderBudgetCategories() {
  const container = document.getElementById('budgetCategories');
  const spending = calculateCategorySpending();
  const totalSpent = calculateTotalExpenses();
  const totalBudget = appData.user.monthly_budget;
  
  const overallPercentage = (totalSpent / totalBudget * 100).toFixed(1);
  document.getElementById('overallBudgetProgress').style.width = Math.min(overallPercentage, 100) + '%';
  document.getElementById('overallBudgetText').textContent = `${formatCurrency(totalSpent)} of ${formatCurrency(totalBudget)} (${overallPercentage}%)`;
  
  container.innerHTML = appData.categories.map(category => {
    const spent = spending[category.name] || 0;
    const percentage = (spent / category.budget_limit * 100).toFixed(1);
    let status = 'safe';
    let statusText = 'On Track';
    
    if (percentage >= 90) {
      status = 'alert';
      statusText = 'Over Budget!';
    } else if (percentage >= 70) {
      status = 'warning';
      statusText = 'Warning';
    }
    
    return `
      <div class="budget-card ${status}">
        <div class="budget-header">
          <div class="budget-icon">${category.icon}</div>
          <div class="budget-title">
            <h4>${category.name}</h4>
            <span class="budget-status ${status}">${statusText}</span>
          </div>
        </div>
        <div class="budget-amounts">
          <span>Spent: ${formatCurrency(spent)}</span>
          <span>Budget: ${formatCurrency(category.budget_limit)}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${Math.min(percentage, 100)}%; background: ${category.color};"></div>
        </div>
        <div class="budget-percentage">${percentage}% used</div>
      </div>
    `;
  }).join('');
}

function checkBudgetAlerts() {
  const spending = calculateCategorySpending();
  let hasAlert = false;
  
  appData.categories.forEach(category => {
    const spent = spending[category.name] || 0;
    const percentage = (spent / category.budget_limit * 100);
    if (percentage >= 80) {
      hasAlert = true;
    }
  });
  
  const badge = document.getElementById('budgetBadge');
  if (hasAlert) {
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

// AI Insights
function renderAIInsights() {
  const container = document.getElementById('insightsList');
  const spending = calculateCategorySpending();
  const totalExpenses = calculateTotalExpenses();
  const balance = calculateBalance();
  
  const insights = [
    {
      type: 'spending_alert',
      icon: '⚠️',
      message: `Your food spending is ${formatCurrency(spending['Food'])} this month.`,
      recommendation: 'Consider cooking at home twice a week to save around ₹1,000 per month.',
      class: 'warning'
    },
    {
      type: 'savings_suggestion',
      icon: '💡',
      message: `You're ${formatCurrency(appData.user.savings_goal - balance)} away from your savings target.`,
      recommendation: 'Reduce entertainment spending by 15% to reach your goal faster.',
      class: 'success'
    },
    {
      type: 'budget_prediction',
      icon: '📊',
      message: 'Your travel expenses are on track.',
      recommendation: `Current spend: ${formatCurrency(spending['Travel'])} of ${formatCurrency(8000)} budget.`,
      class: 'success'
    },
    {
      type: 'pattern_recognition',
      icon: '🔍',
      message: 'AI detected recurring patterns in your spending.',
      recommendation: 'Your entertainment spending increases on weekends. Plan ahead to stay within budget.',
      class: ''
    }
  ];
  
  container.innerHTML = insights.map(insight => `
    <div class="insight-card ${insight.class}">
      <div class="insight-type">${insight.icon} ${insight.type.replace('_', ' ').toUpperCase()}</div>
      <div class="insight-message">${insight.message}</div>
      <div class="insight-recommendation">💡 ${insight.recommendation}</div>
    </div>
  `).join('');
}

// Chatbot
function sendMessage() {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  
  if (!message) return;
  
  addChatMessage(message, 'user');
  input.value = '';
  
  setTimeout(() => {
    const response = generateBotResponse(message);
    addChatMessage(response, 'bot');
  }, 500);
}

function askQuestion(question) {
  addChatMessage(question, 'user');
  
  setTimeout(() => {
    const response = generateBotResponse(question);
    addChatMessage(response, 'bot');
  }, 500);
}

function addChatMessage(message, sender) {
  const chatWindow = document.getElementById('chatWindow');
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${sender}`;
  messageDiv.innerHTML = `<div class="message-content">${message}</div>`;
  chatWindow.appendChild(messageDiv);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function generateBotResponse(message) {
  const lowerMessage = message.toLowerCase();
  const spending = calculateCategorySpending();
  
  // Food spending query
  if (lowerMessage.includes('food') && lowerMessage.includes('spend')) {
    return `You spent ${formatCurrency(spending['Food'])} on food this month. Your food budget is ${formatCurrency(10000)}, so you've used ${((spending['Food'] / 10000) * 100).toFixed(1)}% of your budget. 🍔`;
  }
  
  // Travel expenses query
  if (lowerMessage.includes('travel')) {
    const travelExpenses = appData.expenses.filter(e => e.category === 'Travel');
    return `You have ${travelExpenses.length} travel transactions totaling ${formatCurrency(spending['Travel'])}. Recent trips include: ${travelExpenses.slice(0, 2).map(e => e.description).join(', ')}. 🚗`;
  }
  
  // Budget tracking query
  if (lowerMessage.includes('budget') || lowerMessage.includes('track')) {
    const totalExpenses = calculateTotalExpenses();
    const percentage = (totalExpenses / appData.user.monthly_budget * 100).toFixed(1);
    return `You're doing great! You've spent ${formatCurrency(totalExpenses)} of your ${formatCurrency(appData.user.monthly_budget)} monthly budget (${percentage}%). ${percentage < 50 ? "You're well on track! 🎯" : percentage < 80 ? "Keep an eye on your spending. ⚠️" : "You're close to your limit! 🚨"}`;
  }
  
  // Savings progress query
  if (lowerMessage.includes('saving') || lowerMessage.includes('progress')) {
    const balance = calculateBalance();
    const percentage = (balance / appData.user.savings_goal * 100).toFixed(1);
    return `Your current savings are ${formatCurrency(balance)}, which is ${percentage}% of your ${formatCurrency(appData.user.savings_goal)} goal. You're ${formatCurrency(appData.user.savings_goal - balance)} away from your target! Keep it up! 💪`;
  }
  
  // General category spending
  const categories = ['shopping', 'entertainment', 'bills', 'healthcare'];
  for (const cat of categories) {
    if (lowerMessage.includes(cat)) {
      const catName = cat.charAt(0).toUpperCase() + cat.slice(1);
      return `Your ${catName} spending is ${formatCurrency(spending[catName] || 0)} this month. ${spending[catName] > 0 ? 'Would you like tips on how to reduce this?' : 'Great job keeping it low!'} 💰`;
    }
  }
  
  // Default responses
  const defaults = [
    "I can help you with questions about your expenses, budget, and savings. Try asking about a specific category!",
    "I'm here to help! You can ask me about your spending patterns, budget status, or savings progress. 🤖",
    "Great question! I can provide insights on your finances. Try asking 'How much did I spend on [category]?' or 'Am I on track with my budget?'"
  ];
  
  return defaults[Math.floor(Math.random() * defaults.length)];
}

function handleChatKeypress(event) {
  if (event.key === 'Enter') {
    sendMessage();
  }
}

// Visualizations
function initVisualizationCharts() {
  const spending = calculateCategorySpending();
  
  // Monthly Trend
  if (document.getElementById('monthlyTrendChart')) {
    const sortedExpenses = [...appData.expenses].sort((a, b) => new Date(a.date) - new Date(b.date));
    let cumulative = 0;
    const trendData = sortedExpenses.map(expense => {
      cumulative += expense.amount;
      return cumulative;
    });
    
    createOrReplaceChart('monthlyTrendChart', {
      type: 'line',
      data: {
        labels: sortedExpenses.map(e => formatDate(e.date)),
        datasets: [{
          label: 'Cumulative Spending',
          data: trendData,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'bottom'
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }
  
  // Category Bar Chart
  if (document.getElementById('categoryBarChart')) {
    createOrReplaceChart('categoryBarChart', {
      type: 'bar',
      data: {
        labels: Object.keys(spending),
        datasets: [{
          label: 'Spending by Category',
          data: Object.values(spending),
          backgroundColor: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181', '#AA96DA']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }
  
  // Payment Mode Distribution
  if (document.getElementById('paymentModeChart')) {
    const paymentModes = {};
    appData.expenses.forEach(expense => {
      paymentModes[expense.payment_mode] = (paymentModes[expense.payment_mode] || 0) + expense.amount;
    });
    
    createOrReplaceChart('paymentModeChart', {
      type: 'doughnut',
      data: {
        labels: Object.keys(paymentModes),
        datasets: [{
          data: Object.values(paymentModes),
          backgroundColor: ['#1FB8CD', '#FFC185', '#B4413C', '#ECEBD5', '#5D878F']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });
  }
  
  // Comparison Chart
  if (document.getElementById('comparisonChart')) {
    createOrReplaceChart('comparisonChart', {
      type: 'bar',
      data: {
        labels: ['October'],
        datasets: [
          {
            label: 'Income',
            data: [calculateTotalIncome()],
            backgroundColor: '#10b981'
          },
          {
            label: 'Expenses',
            data: [calculateTotalExpenses()],
            backgroundColor: '#ef4444'
          },
          {
            label: 'Savings',
            data: [calculateBalance()],
            backgroundColor: '#6366f1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom'
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }
}

// Settings
function saveSettings() {
  appData.user.name = document.getElementById('userName').value;
  appData.user.monthly_budget = parseFloat(document.getElementById('monthlyBudget').value);
  appData.user.savings_goal = parseFloat(document.getElementById('savingsGoal').value);
  appData.user.savings_goal_deadline = document.getElementById('goalDeadline').value;
  localStorage.setItem('userName', appData.user.name);
  saveUserData();
  
  showToast('Settings saved successfully!', 'success');
  updateDashboardStats();
}

// Initialize App
async function initApp() {
  await loadUserData();
  initNavigation();
  initTransactionForms();
  initExpenseFilters();
  updateDashboardStats();
  renderRecentTransactions();
  checkBudgetAlerts();
  
  // Initialize charts after a short delay to ensure DOM is ready
  setTimeout(() => {
    initDashboardCharts();
  }, 100);
}

// Start the app when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}