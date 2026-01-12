/**
 * sw-cortex Web App
 *
 * This is a placeholder - task management has been removed.
 * The web UI is currently unused.
 *
 * MCP servers provide the main interface:
 * - mcp__discoveries__* - Knowledge base
 * - mcp__slack-search__* - Slack message search
 * - mcp__logs__* - Log analysis
 * - mcp__db__* - Database access
 * - mcp__github__* - GitHub access
 */

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
      <div className="text-center p-8">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-4">sw-cortex</h1>
        <p className="text-slate-600 dark:text-slate-400">Personal work intelligence platform</p>
        <p className="text-slate-500 dark:text-slate-500 text-sm mt-2">
          Access via Claude Code MCP tools
        </p>
      </div>
    </div>
  );
}
