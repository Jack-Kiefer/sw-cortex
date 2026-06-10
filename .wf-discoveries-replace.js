export const meta = {
  name: 'discoveries-replace',
  description:
    'Replace the discoveries store: add 478 doc-derived discoveries (encrypted via add_discovery), then delete the 100 existing ones.',
  phases: [
    {
      title: 'Add',
      detail: '12 agents add 478 new discoveries (40 each) via the encrypted add_discovery tool',
    },
    { title: 'Delete', detail: '2 agents delete the 100 existing discoveries (50 each)' },
  ],
};

const BD = '/Users/jackkief/Desktop/Projects/sw-cortex/.knowledge-build/batches';
const ADD = [];
for (let i = 0; i < 12; i++) ADD.push(BD + '/add_' + i + '.json');
const DEL = [BD + '/del_0.json', BD + '/del_1.json'];

const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    attempted: { type: 'number' },
    succeeded: { type: 'number' },
    failed: { type: 'number' },
    errors: { type: 'array', items: { type: 'string' } },
  },
  required: ['attempted', 'succeeded', 'failed'],
};

phase('Add');
const addResults = await parallel(
  ADD.map(function (file, i) {
    return function () {
      return agent(
        'You are adding SugarWish knowledge discoveries to an encrypted store. Use ToolSearch to load ' +
          'mcp__discoveries__add_discovery.\n\nSTEP 1: Read the JSON array at ' +
          file +
          ' — each element is a discovery ' +
          'payload {title, description, type, source, tags, priority}.\n\nSTEP 2: For EACH element, call ' +
          'mcp__discoveries__add_discovery with EXACTLY those fields (title, description, type, source:"manual", tags, ' +
          'priority). The server encrypts title/description automatically — do not modify them. Add every item in the file; ' +
          'do not skip, summarize, or merge. If one call errors, record the error and continue with the rest.\n\n' +
          'Report attempted/succeeded/failed counts and any error strings.',
        { label: 'add-batch-' + i, phase: 'Add', schema: REPORT_SCHEMA }
      );
    };
  })
);
let added = 0,
  addFail = 0;
addResults.filter(Boolean).forEach(function (r) {
  added += r.succeeded || 0;
  addFail += r.failed || 0;
});
log('Add phase: ' + added + ' added, ' + addFail + ' failed.');

phase('Delete');
const delResults = await parallel(
  DEL.map(function (file, i) {
    return function () {
      return agent(
        'You are deleting old discoveries that are being replaced. Use ToolSearch to load ' +
          'mcp__discoveries__delete_discovery.\n\nSTEP 1: Read the JSON array at ' +
          file +
          ' — it is an array of discovery ' +
          'ID strings (UUIDs).\n\nSTEP 2: For EACH id, call mcp__discoveries__delete_discovery with { id }. Delete every id ' +
          'in the file. If one errors, record it and continue.\n\nReport attempted/succeeded/failed and any error strings.',
        { label: 'del-batch-' + i, phase: 'Delete', schema: REPORT_SCHEMA }
      );
    };
  })
);
let deleted = 0,
  delFail = 0;
delResults.filter(Boolean).forEach(function (r) {
  deleted += r.succeeded || 0;
  delFail += r.failed || 0;
});
log('Delete phase: ' + deleted + ' deleted, ' + delFail + ' failed.');

return { added: added, addFailed: addFail, deleted: deleted, deleteFailed: delFail };
