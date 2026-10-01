// Offline dry run only. Input is an approved JSON map of Firestore paths to data.
const fs=require('node:fs');const {planMigration}=require('../server/migration.cjs');
const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('Usage: node scripts/migration-plan.cjs approved-snapshot.json private-plan.json');
const plan=planMigration(JSON.parse(fs.readFileSync(input,'utf8')));fs.writeFileSync(output,JSON.stringify(plan,null,2),{mode:0o600,flag:'wx'});
console.log(JSON.stringify({changes:plan.changes.length,issues:plan.issues.length,planDigest:plan.planDigest}));if(plan.issues.length)process.exitCode=1;
