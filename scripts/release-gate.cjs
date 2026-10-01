// This check blocks this workflow; repository/Pages settings must enforce it separately.
const fs=require('node:fs'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const required=['productionRulesCompared','canonicalProfilesVerified','doReservationsBackfilled','rulesEmulatorPassed','browserSuitePassed','stagingAcceptancePassed','databaseBackupVerified','requiredBranchChecksEnabled','pagesDeploymentGateEnabled','productionRuleTestsPassed','serverValidationPassed','concurrentDeletionPassed','migrationDryRunVerified','rollbackRestoreDrillPassed','callableIntegrationPassed','unattendedMonitoringVerified','monitoringAlertsVerified'];
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(p=>p&&!['release-evidence.json','GUARDIAN_REVIEW.md'].includes(p)).sort();
const hash=crypto.createHash('sha256');for(const file of files){hash.update(file+'\0');hash.update(fs.readFileSync(file));hash.update('\0');}const sourceDigest=hash.digest('hex');
if(process.argv.includes('--digest')){console.log(sourceDigest);process.exit(0);}
const file=process.env.GUARDIAN_RELEASE_EVIDENCE||'release-evidence.json';
if(!fs.existsSync(file)){console.error('RELEASE BLOCKED: verified production evidence is missing. See PRODUCTION_READINESS.md.\n'+required.map(k=>'MISSING: '+k).join('\n'));process.exit(1);}
try{
 const evidence=JSON.parse(fs.readFileSync(file,'utf8'));
 const missing=required.filter(k=>evidence[k]?.passed!==true||!evidence[k]?.evidence||!evidence[k]?.verifiedBy||!Number.isFinite(Date.parse(evidence[k]?.verifiedAt)));
 if(evidence.sourceDigest!==sourceDigest)missing.push('evidence does not match current source');
 if(missing.length)throw Error(missing.join(', '));
 console.log('Release evidence matches this source. Deployment must enforce this check.');
}catch(e){console.error('RELEASE BLOCKED: '+e.message);process.exit(1);}
