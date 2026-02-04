const fs = require('fs');
const { parse } = require('csv-parse');
const { transform } = require('stream-transform');
const { stringify } = require('csv-stringify');

// Get input and output paths from command-line arguments
const inputPath = process.argv[2];
const outputPath = process.argv[3];

// Validate that both arguments are provided
if (!inputPath || !outputPath) {
  console.error('Usage: node index.js <inputPath> <outputPath>');
  console.error('Example: node index.js deque.csv linear.csv');
  process.exit(1);
}

const input = fs.createReadStream(inputPath);
const output = fs.createWriteStream(outputPath);

// Title,Description,Priority,Project,Labels
const IMPACT_PRIORITY = {
  'Critical': 'High',
  'Serious': 'Medium',
  'Moderate': 'Low'
}

function getPageName(url) {
  // auth pages
  if (url.includes('/login')) return 'login'
  if (url.includes('/forgot-password')) return 'forgot-password'

  // sketchy core pages
  if (url.includes('/home')) return 'home'
  if (url.includes('/plans')) return 'plans'
  if (url.includes('/unit')) return 'unit'
  if (url.includes('/courses')) return 'courses'
  if (url.includes('/chapter') && url.includes('/lesson')) return 'lesson'

  // test (qbank) pages
  if (url.includes('/test/create')) return 'test-create'
  if (url.includes('/test/history')) return 'test-history'
  if (url.includes('/test/') && url.includes('/session/')) return 'test-session'

  // case pages
  if (url.includes('/cases/') && url.includes('viewDebrief=true')) return 'case-experience-debrief'
  if (url.includes('/cases/')) return 'case-experience'
  if (url.includes('/cases')) return 'case-library'

  // account profile pages
  if (url.includes('/account/profile') && !url.includes('/edit')) return 'account-profile'
  if (url.includes('/account/profile') && url.includes('/edit')) return 'account-profile-edit'

  // account payments pages
  if (url.includes('/account/payments') && !url.includes('/update-billing-info')) return 'account-payments'
  if (url.includes('/account/payments') && url.includes('/update-billing-info')) return 'account-payments-update'
}

function formatCheckpoint(checkpoint) {
  const start = checkpoint.lastIndexOf('(') + 1;
  const end = checkpoint.lastIndexOf(')');
  return checkpoint.substring(start, end);
}

function toBlockquote(text) {
  return text.split('\n')
    .map(line => `> ${line}`)
    .join('\n');
}

try {
  input
    .pipe(parse({ columns: true })) // Parse CSV to JSON objects
    .pipe(transform((record) => {
      const googleQuery = new URLSearchParams({ q: record.Checkpoint }).toString().slice(2)

      const labels = [
        'wcag',
        `wcag:app:${record['Group Name'].replace(' VPAT', '').toLowerCase()}`,
        `wcag:impact:${record.Impact?.toLowerCase()}`,
        `wcag:rule-id:${record['Rule Id']}`,
        `wcag:checkpoint:${formatCheckpoint(record.Checkpoint)}`,
        `wcag:method:${record.Method?.toLowerCase()}`,
        `wcag:page:${getPageName(record.URL)}`,
      ]

      const data = {
        title: `[A11Y] ${record.Summary}`,
        description: `
[Go to page](${record.URL}) • [View in Deque](${record['Issue URL']}) • [WCAG Info](https://www.google.com/search?q=WCAG+${googleQuery})${record['Screenshots']?.length ? ` • [Screenshots](${record['Issue URL']})` : ''}
\`${record.URL}\`

### Description:
${record.Description}
### Recommendation:
${toBlockquote(record['Recommended to fix'])}
### Source Code:
\`\`\`html
${record['Source Code'].replace(/"/g, "'")}
\`\`\`
### Deque:
- Issue ID: \`${record['Issue ID']}\`
- Severity: \`${record.Impact}\`
- Tester: \`${record.User}\`
- Test Unit: \`${record['Test Unit']}\`
- Method: \`${record.Method}\`
- [View in Deque](${record['Issue URL']})
${record['Screenshots']?.length ? `- [Screenshots](${record['Issue URL']})` : ''}
${record['More Info']?.length ? `- [Deque University](${record['More Info']})` : ''}
### WCAG:
- Checkpoint Group: \`${record['Checkpoint Group']}\`
- Checkpoint: \`${record.Checkpoint}\`
- Success Criteria: \`${record['Success Criteria']}\`
- Rule ID: \`${record['Rule Id']}\`
- [More Info](https://www.google.com/search?q=WCAG+${googleQuery})
`,
        priority: IMPACT_PRIORITY[record.Impact],
        status: 'Backlog',
        labels: labels.join(', '),
      };

      return data;
    }))
    .pipe(stringify({
      header: true,
      columns: {
        title: 'Title',
        description: 'Description',
        priority: 'Priority',
        status: 'Status',
        labels: 'Labels',
      }
    }))
    .pipe(output);
} catch (e) {
  console.log('[ERROR]', e)
} finally {
  console.log('[COMPLETE]')
}

