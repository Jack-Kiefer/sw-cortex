/**
 * Generate Odoo Migration Plan HTML Document
 *
 * This script queries live databases for current data counts and generates
 * the migration plan HTML document with up-to-date numbers.
 *
 * Usage: npx ts-node scripts/generate-migration-plan.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// CONFIGURATION (loaded from JSON files in scripts/config/)
// =============================================================================

/** Phase definitions with durations and dependencies */
interface PhaseConfig {
  id: number;
  name: string;
  shortName: string;
  minWeeks: number;
  maxWeeks: number;
  dependencies: number[];
  color: string;
  tasksFile: string;
  milestone: string;
  goal: string;
  tasks: TaskConfig[];
}

interface TaskConfig {
  week: number;
  name: string;
  days: number;
}

interface ProjectConfig {
  startDate: string;
  targetOdooSunset: string;
  preparedFor: string[];
  preparedBy: string;
  documentTitle: string;
}

interface PhaseFileConfig {
  phases: Omit<PhaseConfig, 'tasks'>[];
}

interface TasksFileConfig {
  phaseId: number;
  phaseName: string;
  tasks: TaskConfig[];
}

function loadProjectConfig(): ProjectConfig {
  const configPath = path.join(__dirname, 'config/project.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

function loadPhasesConfig(): PhaseConfig[] {
  const phasesPath = path.join(__dirname, 'config/phases.json');
  const phasesFile: PhaseFileConfig = JSON.parse(fs.readFileSync(phasesPath, 'utf-8'));

  return phasesFile.phases.map((phase) => {
    const tasksPath = path.join(__dirname, 'config', phase.tasksFile);
    const tasksFile: TasksFileConfig = JSON.parse(fs.readFileSync(tasksPath, 'utf-8'));
    return {
      ...phase,
      tasks: tasksFile.tasks,
    };
  });
}

function loadMonthlyActivities(): Record<string, string[]> {
  const activitiesPath = path.join(__dirname, 'config/monthly-activities.json');
  return JSON.parse(fs.readFileSync(activitiesPath, 'utf-8'));
}

// =============================================================================
// DATE UTILITIES
// =============================================================================

interface PhaseSchedule {
  phase: PhaseConfig;
  startDate: Date;
  endDate: Date;
  weekSchedule: WeekSchedule[];
}

interface WeekSchedule {
  weekNum: number;
  startDate: Date;
  endDate: Date;
  tasks: TaskConfig[];
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function calculatePhaseSchedules(startDate: Date, phases: PhaseConfig[]): PhaseSchedule[] {
  const schedules: PhaseSchedule[] = [];
  const phaseEndDates: Map<number, Date> = new Map();

  for (const phase of phases) {
    // Find the latest end date of dependencies
    let phaseStart = startDate;
    for (const depId of phase.dependencies) {
      const depEndDate = phaseEndDates.get(depId);
      if (depEndDate && depEndDate > phaseStart) {
        phaseStart = depEndDate;
      }
    }

    // Use max weeks for scheduling (conservative estimate)
    const phaseEnd = addWeeks(phaseStart, phase.maxWeeks);
    phaseEndDates.set(phase.id, phaseEnd);

    // Build week schedule
    const weekSchedule: WeekSchedule[] = [];
    for (let w = 1; w <= phase.maxWeeks; w++) {
      const weekStart = addWeeks(phaseStart, w - 1);
      const weekEnd = addDays(weekStart, 6);
      const tasks = phase.tasks.filter((t) => t.week === w);
      weekSchedule.push({
        weekNum: w,
        startDate: weekStart,
        endDate: weekEnd,
        tasks,
      });
    }

    schedules.push({
      phase,
      startDate: phaseStart,
      endDate: phaseEnd,
      weekSchedule,
    });
  }

  return schedules;
}

interface DatabaseCounts {
  odoo: {
    purchaseOrders: number;
    openPOs: number;
    awaitingArrival: number;
    draftPOs: number;
    suppliers: number;
    products: number;
    boms: number;
    bills: number;
    manufacturingOrders: number;
    activeMOs: number;
    stockLocations: number;
    stockQuants: number;
  };
  laravel: {
    purchaseOrders: number;
    suppliers: number;
    components: number;
    rawMaterials: number;
  };
}

function loadDataCounts(): DatabaseCounts {
  const countsPath = path.join(__dirname, 'config/data-counts.json');
  const data = JSON.parse(fs.readFileSync(countsPath, 'utf-8'));
  return {
    odoo: data.odoo,
    laravel: data.laravel,
  };
}

function generateCalendarHTML(
  schedules: PhaseSchedule[],
  monthActivities: Record<string, string[]>
): string {
  let html = '';

  // Generate key milestones
  html += `
    <h3>Key Milestones</h3>
    <table>
      <tr>
        <th>Milestone</th>
        <th>Target Date</th>
        <th>Phase</th>
        <th>Status</th>
      </tr>`;

  for (const sched of schedules) {
    html += `
      <tr>
        <td><strong>${sched.phase.milestone}</strong></td>
        <td>${formatDate(sched.endDate)}</td>
        <td>Phase ${sched.phase.id}</td>
        <td>Planned</td>
      </tr>`;
  }

  html += `
    </table>

    <h3>Week-by-Week Schedule</h3>`;

  // Generate detailed calendar for each phase
  for (const sched of schedules) {
    html += `
    <div class="calendar-container">
      <div class="calendar-phase" style="border-color: ${sched.phase.color}">
        <div class="calendar-phase-header">
          <h4>Phase ${sched.phase.id}: ${sched.phase.name}</h4>
          <span class="calendar-phase-dates">${formatShortDate(sched.startDate)} → ${formatShortDate(sched.endDate)}</span>
        </div>`;

    for (const week of sched.weekSchedule) {
      if (week.tasks.length === 0) continue;

      html += `
        <div class="calendar-week">
          <div class="calendar-week-label">Week ${week.weekNum}<br/><small>${formatShortDate(week.startDate)}</small></div>
          <div class="calendar-week-tasks">`;

      for (const task of week.tasks) {
        html += `<span class="calendar-task">${task.name}</span>`;
      }

      html += `
          </div>
        </div>`;
    }

    html += `
      </div>
    </div>`;
  }

  // Add monthly overview
  html += `
    <h3>Monthly Overview</h3>
    <table>
      <tr>
        <th>Month</th>
        <th>Active Phases</th>
        <th>Key Activities</th>
      </tr>`;

  // Group phases by month
  const months = new Map<string, { phases: string[]; activities: string[] }>();
  for (const sched of schedules) {
    let current = new Date(sched.startDate);
    while (current <= sched.endDate) {
      const monthKey = formatMonthYear(current);
      if (!months.has(monthKey)) {
        months.set(monthKey, { phases: [], activities: [] });
      }
      const entry = months.get(monthKey)!;
      if (!entry.phases.includes(`Phase ${sched.phase.id}`)) {
        entry.phases.push(`Phase ${sched.phase.id}`);
      }
      current = addDays(current, 30);
    }
  }

  Array.from(months.entries()).forEach(([month, data]) => {
    const activities = monthActivities[month] || [];
    html += `
      <tr>
        <td><strong>${month}</strong></td>
        <td>${data.phases.join(', ')}</td>
        <td>${activities.join(', ')}</td>
      </tr>`;
  });

  html += `
    </table>`;

  return html;
}

function generateHTML(
  counts: DatabaseCounts,
  schedules: PhaseSchedule[],
  projectConfig: ProjectConfig,
  monthActivities: Record<string, string[]>
): string {
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const projectStartDate = new Date(projectConfig.startDate);
  const startDateFormatted = formatDate(projectStartDate);
  const projectEndDate = schedules[schedules.length - 1].endDate;
  const endDateFormatted = formatDate(projectEndDate);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Odoo to SERP Migration Plan</title>
    <style>
      * {
        box-sizing: border-box;
      }
      body {
        font-family: system-ui, -apple-system, sans-serif;
        max-width: 1000px;
        margin: 40px auto;
        padding: 0 20px;
        line-height: 1.6;
        color: #333;
        background: #fafafa;
      }
      h1 {
        border-bottom: 3px solid #714b67;
        padding-bottom: 10px;
        color: #714b67;
      }
      h2 {
        color: #714b67;
        margin-top: 50px;
        border-left: 4px solid #714b67;
        padding-left: 15px;
      }
      h3 {
        color: #555;
        margin-top: 30px;
      }
      h4 {
        color: #666;
        margin-top: 20px;
        font-size: 1em;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
        background: white;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }
      th,
      td {
        padding: 12px 15px;
        text-align: left;
        border-bottom: 1px solid #e0e0e0;
      }
      th {
        background: #714b67;
        color: white;
        font-weight: 600;
      }
      tr:hover {
        background: #f5f5f5;
      }
      .owner-serp {
        color: #27ae60;
        font-weight: 600;
      }
      .owner-odoo {
        color: #714b67;
        font-weight: 600;
      }
      .owner-qb {
        color: #2980b9;
        font-weight: 600;
      }
      .deprecated {
        color: #e74c3c;
        font-weight: 600;
      }
      code {
        background: #f0f0f0;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 0.9em;
      }
      pre {
        background: #2d2d2d;
        color: #f8f8f2;
        padding: 20px;
        border-radius: 8px;
        overflow-x: auto;
        font-size: 0.85em;
        line-height: 1.5;
      }
      .highlight {
        background: #fff3cd;
        padding: 15px 20px;
        border-left: 4px solid #ffc107;
        margin: 20px 0;
        border-radius: 0 8px 8px 0;
      }
      .highlight.success {
        background: #d4edda;
        border-left-color: #28a745;
      }
      .highlight.danger {
        background: #f8d7da;
        border-left-color: #dc3545;
      }
      .highlight.info {
        background: #e7f1ff;
        border-left-color: #714b67;
      }
      .phase-header {
        background: linear-gradient(135deg, #714b67 0%, #9b6b8e 100%);
        color: white;
        padding: 20px 25px;
        border-radius: 8px;
        margin: 40px 0 20px 0;
      }
      .phase-header h2 {
        color: white;
        margin: 0;
        border: none;
        padding: 0;
      }
      .phase-header .effort {
        font-size: 0.9em;
        opacity: 0.9;
        margin-top: 5px;
      }
      .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 15px;
        margin: 20px 0;
      }
      .summary-card {
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        text-align: center;
      }
      .summary-card .number {
        font-size: 2em;
        font-weight: bold;
        color: #714b67;
      }
      .summary-card .label {
        color: #666;
        font-size: 0.9em;
      }
      .timeline {
        background: white;
        padding: 20px;
        border-radius: 8px;
        margin: 20px 0;
        font-family: monospace;
        font-size: 0.85em;
        overflow-x: auto;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }
      .timeline-row {
        display: flex;
        align-items: center;
        margin: 8px 0;
      }
      .timeline-label {
        width: 120px;
        font-weight: bold;
        flex-shrink: 0;
      }
      .timeline-bar {
        height: 24px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        padding: 0 10px;
        color: white;
        font-size: 0.8em;
        white-space: nowrap;
      }
      .phase1-color {
        background: linear-gradient(90deg, #27ae60, #2ecc71);
      }
      .phase2-color {
        background: linear-gradient(90deg, #3498db, #5dade2);
      }
      .phase3-color {
        background: linear-gradient(90deg, #9b59b6, #bb8fce);
      }
      .phase4-color {
        background: linear-gradient(90deg, #e67e22, #f39c12);
      }
      .phase5-color {
        background: linear-gradient(90deg, #e74c3c, #ec7063);
      }
      .risk-table tr.high td:first-child {
        border-left: 4px solid #e74c3c;
      }
      .risk-table tr.medium td:first-child {
        border-left: 4px solid #f39c12;
      }
      .risk-table tr.low td:first-child {
        border-left: 4px solid #27ae60;
      }
      .checklist {
        list-style: none;
        padding: 0;
      }
      .checklist li {
        padding: 8px 0;
        padding-left: 30px;
        position: relative;
      }
      .checklist li::before {
        content: '\\2610';
        position: absolute;
        left: 0;
        color: #714b67;
      }
      .meta {
        color: #666;
        font-size: 0.9em;
        margin-bottom: 30px;
      }
      .toc {
        background: white;
        padding: 20px 30px;
        border-radius: 8px;
        margin: 30px 0;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }
      .toc h3 {
        margin-top: 0;
      }
      .toc ul {
        columns: 2;
        column-gap: 40px;
      }
      .toc li {
        margin: 5px 0;
      }
      .toc a {
        color: #714b67;
        text-decoration: none;
      }
      .toc a:hover {
        text-decoration: underline;
      }
      .calendar-container {
        background: white;
        border-radius: 8px;
        padding: 20px;
        margin: 20px 0;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        overflow-x: auto;
      }
      .calendar-phase {
        margin-bottom: 30px;
        border-left: 4px solid;
        padding-left: 15px;
      }
      .calendar-phase-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        flex-wrap: wrap;
        gap: 10px;
      }
      .calendar-phase-header h4 {
        margin: 0;
        color: #333;
      }
      .calendar-phase-dates {
        font-size: 0.9em;
        color: #666;
        background: #f5f5f5;
        padding: 5px 12px;
        border-radius: 20px;
      }
      .calendar-week {
        display: grid;
        grid-template-columns: 120px 1fr;
        gap: 10px;
        margin-bottom: 10px;
        align-items: start;
      }
      .calendar-week-label {
        font-weight: 600;
        font-size: 0.85em;
        color: #555;
        padding-top: 5px;
      }
      .calendar-week-tasks {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .calendar-task {
        font-size: 0.8em;
        padding: 4px 10px;
        border-radius: 4px;
        background: #f0f0f0;
        color: #333;
        white-space: nowrap;
      }
      .calendar-task.backend { background: #e8f5e9; color: #2e7d32; }
      .calendar-task.frontend { background: #e3f2fd; color: #1565c0; }
      .calendar-task.qa { background: #fff3e0; color: #e65100; }
      .calendar-task.pm { background: #f3e5f5; color: #7b1fa2; }
      .calendar-task.devops { background: #fce4ec; color: #c2185b; }
      .calendar-task.all { background: #714b67; color: white; }
      .calendar-milestone {
        background: linear-gradient(135deg, #714b67 0%, #9b6b8e 100%);
        padding: 15px 20px;
        border-radius: 8px;
        margin: 20px 0;
        color: white;
      }
      .calendar-milestone h4 {
        margin: 0 0 5px 0;
        color: white;
      }
      .calendar-milestone p {
        margin: 0;
        opacity: 0.9;
        font-size: 0.9em;
      }
      .gantt-chart {
        display: grid;
        grid-template-columns: 150px repeat(40, 20px);
        gap: 2px;
        font-size: 0.75em;
        margin: 30px 0;
      }
      .gantt-header {
        background: #714b67;
        color: white;
        padding: 5px;
        text-align: center;
        font-weight: bold;
      }
      .gantt-label {
        padding: 8px 5px;
        font-weight: 600;
        background: #f5f5f5;
        white-space: nowrap;
      }
      .gantt-cell {
        padding: 8px 0;
      }
      .gantt-bar {
        height: 20px;
        border-radius: 3px;
      }
      @media (max-width: 600px) {
        .toc ul {
          columns: 1;
        }
        .summary-grid {
          grid-template-columns: 1fr 1fr;
        }
        .calendar-week {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <h1>${projectConfig.documentTitle}</h1>

    <div class="meta">
      <strong>Prepared for:</strong> ${projectConfig.preparedFor.join(', ')}<br />
      <strong>Prepared by:</strong> ${projectConfig.preparedBy}<br />
      <strong>Date:</strong> ${today}<br />
      <strong>Project Start:</strong> ${startDateFormatted}<br />
      <strong>Target Odoo Sunset:</strong> ${formatDate(new Date(projectConfig.targetOdooSunset))}
    </div>

    <div class="toc">
      <h3>Table of Contents</h3>
      <ul>
        <li><a href="#summary">Executive Summary</a></li>
        <li><a href="#data">Current Data Volumes</a></li>
        <li><a href="#calendar">Implementation Calendar</a></li>
        <li><a href="#phase1">Phase 1: Purchase Orders</a></li>
        <li><a href="#phase2">Phase 2: Vendor Bills</a></li>
        <li><a href="#phase3">Phase 3: Raw Materials & Components</a></li>
        <li><a href="#phase4">Phase 4: Manufacturing Orders</a></li>
        <li><a href="#phase5">Phase 5: Inventory Management</a></li>
        <li><a href="#timeline">Timeline Summary</a></li>
        <li><a href="#resources">Resource Requirements</a></li>
        <li><a href="#questions">Questions to Resolve</a></li>
        <li><a href="#risks">Risk Register</a></li>
      </ul>
    </div>

    <h2 id="summary">Executive Summary</h2>

    <p>
      This document provides a detailed breakdown of migrating from Odoo to SERP/Laravel across five
      phases:
    </p>

    <table>
      <tr>
        <th>Phase</th>
        <th>Scope</th>
        <th>Level of Effort</th>
        <th>Dependencies</th>
      </tr>
      <tr>
        <td><strong>1. Purchase Orders</strong></td>
        <td>PO creation, approvals, arrivals</td>
        <td>4-6 weeks</td>
        <td>None</td>
      </tr>
      <tr>
        <td><strong>2. Vendor Bills</strong></td>
        <td>Bill creation from POs</td>
        <td>6-8 weeks</td>
        <td>Phase 1</td>
      </tr>
      <tr>
        <td><strong>3. Raw Materials & Components</strong></td>
        <td>Product master data</td>
        <td>4-5 weeks</td>
        <td>Phase 1</td>
      </tr>
      <tr>
        <td><strong>4. Manufacturing Orders</strong></td>
        <td>BOMs and production</td>
        <td>6-8 weeks</td>
        <td>Phase 3</td>
      </tr>
      <tr>
        <td><strong>5. Inventory Management</strong></td>
        <td>Stock tracking, locations</td>
        <td>8-10 weeks</td>
        <td>Phases 3 & 4</td>
      </tr>
    </table>

    <div class="highlight info">
      <strong>Total estimated timeline: 28-37 weeks (7-9 months)</strong><br />
      For July sunset: Must begin Phase 1 immediately (February) to allow buffer.
    </div>

    <h2 id="data">Current State: Data Volumes</h2>

    <h3>Odoo Data (Production)</h3>

    <div class="summary-grid">
      <div class="summary-card">
        <div class="number">${counts.odoo.purchaseOrders.toLocaleString()}</div>
        <div class="label">Purchase Orders<br /><small>${counts.odoo.awaitingArrival} awaiting arrival</small></div>
      </div>
      <div class="summary-card">
        <div class="number">${counts.odoo.suppliers.toLocaleString()}</div>
        <div class="label">Suppliers</div>
      </div>
      <div class="summary-card">
        <div class="number">${counts.odoo.products.toLocaleString()}</div>
        <div class="label">Products</div>
      </div>
      <div class="summary-card">
        <div class="number">${counts.odoo.boms.toLocaleString()}</div>
        <div class="label">Bills of Materials</div>
      </div>
      <div class="summary-card">
        <div class="number">${counts.odoo.bills.toLocaleString()}</div>
        <div class="label">Vendor Bills</div>
      </div>
      <div class="summary-card">
        <div class="number">${counts.odoo.manufacturingOrders.toLocaleString()}</div>
        <div class="label">Manufacturing Orders<br /><small>${counts.odoo.activeMOs} currently active</small></div>
      </div>
      <div class="summary-card">
        <div class="number">${counts.odoo.stockLocations.toLocaleString()}</div>
        <div class="label">Stock Locations</div>
      </div>
      <div class="summary-card">
        <div class="number">${counts.odoo.stockQuants.toLocaleString()}</div>
        <div class="label">Inventory Records</div>
      </div>
    </div>

    <h3>SERP/Laravel Current State</h3>
    <div class="summary-grid">
      <div class="summary-card">
        <div class="number">${counts.laravel.purchaseOrders.toLocaleString()}</div>
        <div class="label">Purchase Orders</div>
      </div>
      <div class="summary-card">
        <div class="number">${counts.laravel.suppliers.toLocaleString()}</div>
        <div class="label">Suppliers</div>
      </div>
      <div class="summary-card">
        <div class="number">${counts.laravel.components.toLocaleString()}</div>
        <div class="label">Components</div>
      </div>
      <div class="summary-card">
        <div class="number">${counts.laravel.rawMaterials.toLocaleString()}</div>
        <div class="label">Raw Materials</div>
      </div>
    </div>

    <ul>
      <li><strong>Purchase Order System:</strong> Exists and functional (status workflow, approvals, blanket POs)</li>
      <li><strong>Suppliers Table:</strong> Exists, needs <code>odoo_partner_id</code> column</li>
      <li><strong>Components Table:</strong> Exists with <code>odoo_id</code> column</li>
      <li><strong>Raw Materials Table:</strong> Exists with <code>odoo_id</code> column</li>
      <li><strong>Odoo Integration:</strong> Mature patterns exist (asyncpg reads, XML-RPC writes)</li>
    </ul>

    <!-- IMPLEMENTATION CALENDAR -->
    <h2 id="calendar">Implementation Calendar</h2>

    <div class="highlight info">
      <strong>Project Timeline:</strong> ${startDateFormatted} → ${endDateFormatted}<br/>
      All dates calculated from project start. Phases begin after their dependencies complete.
    </div>

    ${generateCalendarHTML(schedules, monthActivities)}

    <!-- PHASE 1 -->
    <div class="phase-header" id="phase1">
      <h2>Phase 1: Purchase Orders</h2>
      <div class="effort">4-6 weeks | No dependencies</div>
    </div>

    <h3>Goal</h3>
    <p>
      Move all purchase order creation and management to SERP. Odoo receives PO data only when goods
      arrive (for billing purposes).
    </p>

    <h3>Data Ownership After Phase 1</h3>
    <table>
      <tr>
        <th>Data</th>
        <th>Owner</th>
        <th>Notes</th>
      </tr>
      <tr>
        <td>Purchase Orders</td>
        <td class="owner-serp">SERP</td>
        <td>Source of truth for all PO data</td>
      </tr>
      <tr>
        <td>PO Approvals</td>
        <td class="owner-serp">SERP</td>
        <td>Ops and Finance approval workflow</td>
      </tr>
      <tr>
        <td>Arrivals/Receipts</td>
        <td class="owner-serp">SERP</td>
        <td>Arrival tracking and confirmation</td>
      </tr>
      <tr>
        <td>Suppliers</td>
        <td class="owner-serp">SERP</td>
        <td>Vendor master data</td>
      </tr>
      <tr>
        <td>Inventory Counts</td>
        <td class="owner-odoo">Odoo</td>
        <td>Updated when arrival pushed</td>
      </tr>
      <tr>
        <td>Vendor Bills</td>
        <td class="owner-odoo">Odoo</td>
        <td>Created by accountants after arrival</td>
      </tr>
    </table>

    <h3>Data to Migrate</h3>
    <table>
      <tr>
        <th>Source (Odoo)</th>
        <th>Target (Laravel)</th>
        <th>Records</th>
        <th>Notes</th>
      </tr>
      <tr>
        <td><code>res_partner</code> (suppliers)</td>
        <td><code>suppliers</code></td>
        <td>${counts.odoo.suppliers.toLocaleString()}</td>
        <td>Map id &rarr; odoo_partner_id</td>
      </tr>
      <tr>
        <td><code>purchase_order</code></td>
        <td><code>purchase_orders</code></td>
        <td>${counts.odoo.purchaseOrders.toLocaleString()}</td>
        <td>All historical + open POs</td>
      </tr>
      <tr>
        <td><code>purchase_order_line</code></td>
        <td><code>purchase_items</code></td>
        <td>~8,000 est.</td>
        <td>Line items with quantities</td>
      </tr>
      <tr>
        <td><code>stock_move</code> (arrived qty)</td>
        <td><code>purchase_items.arrived_qty</code></td>
        <td>&mdash;</td>
        <td>Calculate from done moves</td>
      </tr>
    </table>

    <h3>Database Schema Changes</h3>
    <pre>-- Laravel migrations required
ALTER TABLE suppliers
  ADD COLUMN odoo_partner_id INT NULL,
  ADD INDEX idx_odoo_partner_id (odoo_partner_id);

ALTER TABLE purchase_orders
  ADD COLUMN odoo_po_id INT NULL,
  ADD COLUMN odoo_pushed_at DATETIME NULL,
  ADD INDEX idx_odoo_po_id (odoo_po_id);

ALTER TABLE purchase_items
  ADD COLUMN odoo_po_line_id INT NULL,
  ADD COLUMN odoo_qty_pushed DECIMAL(10,2) DEFAULT 0,
  ADD INDEX idx_odoo_po_line_id (odoo_po_line_id);</pre>

    <h3>Tasks Breakdown</h3>

    <h4>Week 1-2: Schema & Infrastructure</h4>
    <table>
      <tr><th>Task</th><th>Effort</th><th>Owner</th></tr>
      <tr><td>Add sync columns to Laravel tables</td><td>2 days</td><td>Backend</td></tr>
      <tr><td>Create migration scripts framework</td><td>2 days</td><td>Backend</td></tr>
      <tr><td>Set up Odoo staging environment for testing</td><td>1 day</td><td>DevOps</td></tr>
      <tr><td>Review SERP Odoo integration patterns</td><td>1 day</td><td>Backend</td></tr>
      <tr><td>Design arrival &rarr; Odoo push API</td><td>2 days</td><td>Backend</td></tr>
    </table>

    <h4>Week 2-3: Data Migration</h4>
    <table>
      <tr><th>Task</th><th>Effort</th><th>Owner</th></tr>
      <tr><td>Export suppliers from Odoo with ID mapping</td><td>1 day</td><td>Backend</td></tr>
      <tr><td>Export all POs (historical + open)</td><td>2 days</td><td>Backend</td></tr>
      <tr><td>Export PO line items with quantities</td><td>2 days</td><td>Backend</td></tr>
      <tr><td>Calculate arrived quantities from stock_move</td><td>1 day</td><td>Backend</td></tr>
      <tr><td>Validate migrated data against Odoo</td><td>2 days</td><td>QA</td></tr>
      <tr><td>Reconciliation report for discrepancies</td><td>1 day</td><td>Backend</td></tr>
    </table>

    <h4>Week 3-4: Odoo Push Integration</h4>
    <table>
      <tr><th>Task</th><th>Effort</th><th>Owner</th></tr>
      <tr><td>Build XML-RPC service for PO creation</td><td>3 days</td><td>Backend</td></tr>
      <tr><td>Build receipt (stock.picking) creation</td><td>2 days</td><td>Backend</td></tr>
      <tr><td>Implement batch processing (50 items, 1s delay)</td><td>1 day</td><td>Backend</td></tr>
      <tr><td>Build job queue for async push</td><td>2 days</td><td>Backend</td></tr>
      <tr><td>Handle partial arrivals (delta sync)</td><td>2 days</td><td>Backend</td></tr>
      <tr><td>Error handling and retry logic</td><td>1 day</td><td>Backend</td></tr>
    </table>

    <h4>Week 4-5: UI & Workflow</h4>
    <table>
      <tr><th>Task</th><th>Effort</th><th>Owner</th></tr>
      <tr><td>Add "Mark as Arrived" button to PO UI</td><td>1 day</td><td>Frontend</td></tr>
      <tr><td>Add "Push to Odoo" status indicator</td><td>1 day</td><td>Frontend</td></tr>
      <tr><td>Add sync error notifications</td><td>1 day</td><td>Frontend</td></tr>
      <tr><td>Update PO list to show sync status</td><td>1 day</td><td>Frontend</td></tr>
      <tr><td>Test approval workflow end-to-end</td><td>2 days</td><td>QA</td></tr>
      <tr><td>Document new workflow for purchasing team</td><td>1 day</td><td>PM</td></tr>
    </table>

    <h4>Week 5-6: Cutover & Training</h4>
    <table>
      <tr><th>Task</th><th>Effort</th><th>Owner</th></tr>
      <tr><td>Disable PO creation in Odoo (permissions)</td><td>1 day</td><td>Admin</td></tr>
      <tr><td>Train purchasing team on SERP</td><td>2 days</td><td>PM</td></tr>
      <tr><td>Parallel run: verify arrivals sync correctly</td><td>5 days</td><td>QA</td></tr>
      <tr><td>Monitor sync logs for failures</td><td>Ongoing</td><td>DevOps</td></tr>
      <tr><td>Go-live sign-off</td><td>1 day</td><td>Stakeholders</td></tr>
    </table>

    <h3>Risks & Mitigations</h3>
    <table class="risk-table">
      <tr><th>Risk</th><th>Impact</th><th>Mitigation</th></tr>
      <tr class="medium"><td>Sync failure on arrival</td><td>Bills not created</td><td>Retry queue + alerting</td></tr>
      <tr class="medium"><td>Data mismatch after migration</td><td>Accounting errors</td><td>Reconciliation report before cutover</td></tr>
      <tr class="medium"><td>Partial arrival complexity</td><td>Duplicate receipts</td><td>Track odoo_qty_pushed per line</td></tr>
      <tr class="low"><td>${counts.odoo.awaitingArrival} POs awaiting arrival during cutover</td><td>Dual entry needed</td><td>Migrate these last, brief parallel period</td></tr>
    </table>

    <h3>Success Criteria</h3>
    <ul class="checklist">
      <li>All new POs created in SERP only</li>
      <li>All arrivals push to Odoo within 5 minutes</li>
      <li>Accountants can create bills from pushed POs</li>
      <li>Ric can see open POs for cash flow in SERP</li>
      <li>Zero duplicate POs between systems</li>
    </ul>

    <!-- PHASE 2 -->
    <div class="phase-header" id="phase2">
      <h2>Phase 2: Vendor Bills</h2>
      <div class="effort">6-8 weeks | Depends on Phase 1</div>
    </div>

    <h3>Goal</h3>
    <p>
      Move bill creation from Odoo to SERP. Bills link directly to SERP POs. Only send inventory
      quantities to Odoo (not full PO data).
    </p>

    <h3>Data Ownership After Phase 2</h3>
    <table>
      <tr>
        <th>Data</th>
        <th>Owner</th>
        <th>Notes</th>
      </tr>
      <tr>
        <td>Vendor Bills</td>
        <td class="owner-serp">SERP</td>
        <td>Bill creation and tracking</td>
      </tr>
      <tr>
        <td>Bill Line Items</td>
        <td class="owner-serp">SERP</td>
        <td>Linked to PO lines</td>
      </tr>
      <tr>
        <td>Bill Approval</td>
        <td class="owner-serp">SERP</td>
        <td>Finance approval workflow</td>
      </tr>
      <tr>
        <td>Payment Tracking</td>
        <td class="owner-qb">QuickBooks</td>
        <td>Unchanged</td>
      </tr>
      <tr>
        <td>Inventory Updates</td>
        <td class="owner-odoo">Odoo</td>
        <td>Receive qty only</td>
      </tr>
    </table>

    <h3>Data to Migrate</h3>
    <table>
      <tr>
        <th>Source (Odoo)</th>
        <th>Target (Laravel)</th>
        <th>Records</th>
        <th>Notes</th>
      </tr>
      <tr>
        <td><code>account_move</code> (in_invoice)</td>
        <td><code>vendor_bills</code> (new)</td>
        <td>${counts.odoo.bills.toLocaleString()}</td>
        <td>Historical bills</td>
      </tr>
      <tr>
        <td><code>account_move_line</code></td>
        <td><code>vendor_bill_items</code> (new)</td>
        <td>~12,000</td>
        <td>Line items</td>
      </tr>
      <tr>
        <td><code>account_move_purchase_order_rel</code></td>
        <td>FK on bills</td>
        <td>&mdash;</td>
        <td>Link bills to POs</td>
      </tr>
    </table>

    <div class="highlight">
      <strong>Critical Note:</strong> 192 bills consolidate multiple POs. The new schema supports
      this via a junction table (<code>vendor_bill_po_links</code>).
    </div>

    <!-- PHASE 3 -->
    <div class="phase-header" id="phase3">
      <h2>Phase 3: Raw Materials & Components</h2>
      <div class="effort">4-5 weeks | Depends on Phase 1</div>
    </div>

    <h3>Goal</h3>
    <p>
      Move product master data ownership to SERP. Inventory counts remain in Odoo until Phase 5.
    </p>

    <h3>Data to Migrate</h3>
    <table>
      <tr>
        <th>Source (Odoo)</th>
        <th>Target (Laravel)</th>
        <th>Records</th>
        <th>Notes</th>
      </tr>
      <tr>
        <td><code>product_product</code></td>
        <td><code>components</code> / <code>raw_materials</code></td>
        <td>${counts.odoo.products.toLocaleString()}</td>
        <td>Product master data</td>
      </tr>
      <tr>
        <td><code>product_template</code></td>
        <td>Attributes on products</td>
        <td>&mdash;</td>
        <td>Shared product attributes</td>
      </tr>
      <tr>
        <td><code>product_category</code></td>
        <td><code>product_categories</code> (new)</td>
        <td>~50 est.</td>
        <td>Category hierarchy</td>
      </tr>
      <tr>
        <td><code>product_supplierinfo</code></td>
        <td><code>supplier_products</code></td>
        <td>~500 est.</td>
        <td>Supplier-product links</td>
      </tr>
    </table>

    <!-- PHASE 4 -->
    <div class="phase-header" id="phase4">
      <h2>Phase 4: Manufacturing Orders</h2>
      <div class="effort">6-8 weeks | Depends on Phase 3</div>
    </div>

    <h3>Goal</h3>
    <p>
      Move Bill of Materials (BOM) ownership and manufacturing order creation to SERP. Production
      pushes to Odoo for inventory updates.
    </p>

    <h3>Data to Migrate</h3>
    <table>
      <tr>
        <th>Source (Odoo)</th>
        <th>Target (Laravel)</th>
        <th>Records</th>
        <th>Notes</th>
      </tr>
      <tr>
        <td><code>mrp_bom</code></td>
        <td><code>boms</code> (new)</td>
        <td>${counts.odoo.boms.toLocaleString()}</td>
        <td>Bill of materials</td>
      </tr>
      <tr>
        <td><code>mrp_bom_line</code></td>
        <td><code>bom_lines</code> (new)</td>
        <td>~6,000 est.</td>
        <td>BOM components</td>
      </tr>
      <tr>
        <td><code>mrp_production</code></td>
        <td><code>manufacturing_orders</code> (new)</td>
        <td>${counts.odoo.manufacturingOrders.toLocaleString()}</td>
        <td>Historical MOs</td>
      </tr>
      <tr>
        <td><code>mrp_production_line</code></td>
        <td><code>mo_lines</code> (new)</td>
        <td>~100,000 est.</td>
        <td>MO line items</td>
      </tr>
    </table>

    <!-- PHASE 5 -->
    <div class="phase-header" id="phase5">
      <h2>Phase 5: Inventory Management</h2>
      <div class="effort">8-10 weeks | Depends on Phases 3 & 4</div>
    </div>

    <h3>Goal</h3>
    <p>Move all inventory tracking to SERP. Odoo becomes optional/deprecated.</p>

    <div class="highlight danger">
      <strong>High Risk Phase:</strong> Inventory is business-critical. Plan cutover during
      low-activity period. Extensive testing required.
    </div>

    <h3>Data to Migrate</h3>
    <table>
      <tr>
        <th>Source (Odoo)</th>
        <th>Target (Laravel)</th>
        <th>Records</th>
        <th>Notes</th>
      </tr>
      <tr>
        <td><code>stock_location</code></td>
        <td><code>stock_locations</code> (new)</td>
        <td>${counts.odoo.stockLocations.toLocaleString()}</td>
        <td>Warehouse structure</td>
      </tr>
      <tr>
        <td><code>stock_quant</code></td>
        <td><code>stock_quantities</code> (new)</td>
        <td>${counts.odoo.stockQuants.toLocaleString()}</td>
        <td>Current inventory</td>
      </tr>
      <tr>
        <td><code>stock_move</code></td>
        <td><code>stock_moves</code> (new)</td>
        <td>48,909+</td>
        <td>Movement history</td>
      </tr>
    </table>

    <!-- TIMELINE -->
    <h2 id="timeline">Timeline Summary</h2>

    <div class="timeline">
      <div class="timeline-row">
        <div class="timeline-label">Feb 2026</div>
        <div class="timeline-bar phase1-color" style="width: 200px">Phase 1: Purchase Orders (6 wks)</div>
      </div>
      <div class="timeline-row">
        <div class="timeline-label">Mar-Apr</div>
        <div class="timeline-bar phase2-color" style="width: 270px">Phase 2: Vendor Bills (8 wks)</div>
      </div>
      <div class="timeline-row">
        <div class="timeline-label">Apr-May</div>
        <div class="timeline-bar phase3-color" style="width: 170px">Phase 3: Raw Materials (5 wks)</div>
      </div>
      <div class="timeline-row">
        <div class="timeline-label">May-Jul</div>
        <div class="timeline-bar phase4-color" style="width: 270px">Phase 4: Manufacturing (8 wks)</div>
      </div>
      <div class="timeline-row">
        <div class="timeline-label">Jul-Sep</div>
        <div class="timeline-bar phase5-color" style="width: 340px">Phase 5: Inventory (10 wks)</div>
      </div>
    </div>

    <h3>Realistic July Target</h3>
    <table>
      <tr>
        <th>Phase</th>
        <th>Can Complete by July?</th>
        <th>Notes</th>
      </tr>
      <tr>
        <td>Phase 1: Purchase Orders</td>
        <td style="color: #27ae60; font-weight: bold">Yes</td>
        <td>Start immediately</td>
      </tr>
      <tr>
        <td>Phase 2: Vendor Bills</td>
        <td style="color: #27ae60; font-weight: bold">Yes</td>
        <td>Parallel with Phase 3</td>
      </tr>
      <tr>
        <td>Phase 3: Raw Materials</td>
        <td style="color: #27ae60; font-weight: bold">Yes</td>
        <td>Parallel with Phase 2</td>
      </tr>
      <tr>
        <td>Phase 4: Manufacturing</td>
        <td style="color: #f39c12; font-weight: bold">Maybe</td>
        <td>Depends on complexity</td>
      </tr>
      <tr>
        <td>Phase 5: Inventory</td>
        <td style="color: #e74c3c; font-weight: bold">No</td>
        <td>High risk; target September</td>
      </tr>
    </table>

    <div class="highlight success">
      <strong>Recommendation:</strong> Target July sunset for Phases 1-4. Keep Odoo running for
      inventory only until September.
    </div>

    <!-- RESOURCES -->
    <h2 id="resources">Resource Requirements</h2>

    <h3>Development Team</h3>
    <table>
      <tr>
        <th>Role</th>
        <th>Phase 1</th>
        <th>Phase 2</th>
        <th>Phase 3</th>
        <th>Phase 4</th>
        <th>Phase 5</th>
      </tr>
      <tr>
        <td>Backend Developer</td>
        <td>1 FT</td>
        <td>1 FT</td>
        <td>0.5 FT</td>
        <td>1 FT</td>
        <td>1 FT</td>
      </tr>
      <tr>
        <td>Frontend Developer</td>
        <td>0.5 FT</td>
        <td>0.5 FT</td>
        <td>0.5 FT</td>
        <td>1 FT</td>
        <td>1 FT</td>
      </tr>
      <tr>
        <td>QA Engineer</td>
        <td>0.5 FT</td>
        <td>0.5 FT</td>
        <td>0.25 FT</td>
        <td>0.5 FT</td>
        <td>1 FT</td>
      </tr>
      <tr>
        <td>PM/Training</td>
        <td>0.25 FT</td>
        <td>0.25 FT</td>
        <td>0.25 FT</td>
        <td>0.25 FT</td>
        <td>0.5 FT</td>
      </tr>
    </table>

    <!-- QUESTIONS -->
    <h2 id="questions">Questions to Resolve</h2>
    <ol>
      <li><strong>July deadline flexibility:</strong> Can inventory (Phase 5) extend to September?</li>
      <li><strong>Parallel vs sequential:</strong> Can Phases 2 & 3 run fully parallel (doubles resource need)?</li>
      <li><strong>QuickBooks integration:</strong> Is existing QB integration sufficient for Phase 2, or new work needed?</li>
      <li><strong>Active MOs:</strong> Should the ${counts.odoo.activeMOs} active manufacturing orders complete in Odoo before Phase 4 cutover?</li>
      <li><strong>Stuck stock moves:</strong> Should the 48,909 stuck moves be cleaned up before Phase 5, or ignore them?</li>
      <li><strong>Training approach:</strong> Phased training per cutover, or comprehensive training at end?</li>
    </ol>

    <!-- RISKS -->
    <h2 id="risks">Risk Register</h2>
    <table class="risk-table">
      <tr>
        <th>ID</th>
        <th>Risk</th>
        <th>Phase</th>
        <th>Probability</th>
        <th>Impact</th>
        <th>Mitigation</th>
        <th>Owner</th>
      </tr>
      <tr class="medium">
        <td>R1</td>
        <td>Sync failure causes missing bills</td>
        <td>1, 2</td>
        <td>Medium</td>
        <td>High</td>
        <td>Retry queue, alerting</td>
        <td>Backend</td>
      </tr>
      <tr class="medium">
        <td>R2</td>
        <td>Data migration errors</td>
        <td>All</td>
        <td>Medium</td>
        <td>High</td>
        <td>Reconciliation reports, rollback plan</td>
        <td>Backend</td>
      </tr>
      <tr class="low">
        <td>R3</td>
        <td>User adoption resistance</td>
        <td>All</td>
        <td>Low</td>
        <td>Medium</td>
        <td>Early involvement, training</td>
        <td>PM</td>
      </tr>
      <tr class="medium">
        <td>R4</td>
        <td>Timeline slippage</td>
        <td>All</td>
        <td>Medium</td>
        <td>Medium</td>
        <td>Buffer built in, scope flexibility</td>
        <td>PM</td>
      </tr>
      <tr class="high">
        <td>R5</td>
        <td>Inventory mismatch</td>
        <td>5</td>
        <td>High</td>
        <td>Critical</td>
        <td>Extensive testing, cutover during low period</td>
        <td>QA</td>
      </tr>
      <tr class="medium">
        <td>R6</td>
        <td>Multi-level BOM errors</td>
        <td>4</td>
        <td>Medium</td>
        <td>High</td>
        <td>Thorough BOM testing</td>
        <td>QA</td>
      </tr>
      <tr class="medium">
        <td>R7</td>
        <td>Peak season pressure</td>
        <td>4, 5</td>
        <td>Medium</td>
        <td>High</td>
        <td>Prioritize Phases 1-3 before peak</td>
        <td>PM</td>
      </tr>
    </table>

    <hr style="margin-top: 50px; border: none; border-top: 1px solid #ddd" />
    <p style="color: #666; font-size: 0.9em; text-align: center">
      <em>Document Version: 1.0 | Last Updated: ${today} | Generated by generate-migration-plan.ts</em>
    </p>
  </body>
</html>`;
}

function main() {
  // Load configuration from JSON files
  console.log('Loading configuration...');
  const projectConfig = loadProjectConfig();
  const phases = loadPhasesConfig();
  const monthActivities = loadMonthlyActivities();

  console.log(`  Project: ${projectConfig.documentTitle}`);
  console.log(`  Start Date: ${projectConfig.startDate}`);
  console.log(`  Phases: ${phases.length}`);

  console.log('\nLoading data counts from config...');
  const counts = loadDataCounts();
  console.log('  Odoo POs:', counts.odoo.purchaseOrders);
  console.log('  Odoo Products:', counts.odoo.products);
  console.log('  Laravel Components:', counts.laravel.components);

  console.log('\nCalculating project schedule...');
  const projectStartDate = new Date(projectConfig.startDate);
  console.log('  Start Date:', formatDate(projectStartDate));
  const schedules = calculatePhaseSchedules(projectStartDate, phases);

  for (const sched of schedules) {
    console.log(
      `  Phase ${sched.phase.id}: ${formatShortDate(sched.startDate)} → ${formatShortDate(sched.endDate)} (${sched.phase.name})`
    );
  }

  console.log('\nGenerating HTML...');
  const html = generateHTML(counts, schedules, projectConfig, monthActivities);

  const outputPath = path.join(__dirname, '../docs/odoo-migration-plan.html');
  fs.writeFileSync(outputPath, html);
  console.log(`\nGenerated: ${outputPath}`);
}

main();
