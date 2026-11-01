require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const dept = await prisma.department.upsert({
    where: { name: 'Greater Bengaluru Authority / Bengaluru City Corporations — civic services' },
    update: { description: 'Public streetlight and pothole grievances are listed in the authority’s Sahaaya 2.0 public grievance service. BBMP public pages document municipal solid waste management responsibilities. Contact details below are authority-wide, not a named officer or department mailbox.', categories: ['Road / pothole damage', 'Garbage / waste', 'Streetlight / electrical'], officialWebsite: 'https://bbmp.gov.in/', complaintPortal: 'https://bbmp.gov.in/', demo: false },
    create: { name: 'Greater Bengaluru Authority / Bengaluru City Corporations — civic services', jurisdiction: 'Bengaluru, Karnataka', description: 'Public streetlight and pothole grievances are listed in the authority’s Sahaaya 2.0 public grievance service. BBMP public pages document municipal solid waste management responsibilities. Contact details below are authority-wide, not a named officer or department mailbox.', categories: ['Road / pothole damage', 'Garbage / waste', 'Streetlight / electrical'], officialWebsite: 'https://bbmp.gov.in/', complaintPortal: 'https://bbmp.gov.in/', demo: false }
  });
  const source = 'https://bbmp.gov.in/';
  const verified = new Date('2026-11-01T00:00:00.000Z');
  const contacts = [
    { label: 'Public helpline (authority-wide)', phone: '1533', sourceUrl: 'https://bbmp.gov.in/', notes: 'Published as Greater Bengaluru Authority helpline. Verify before use; not a report-specific line.' },
    { label: 'Head office email (authority-wide)', email: 'comm@bbmp.gov.in', sourceUrl: 'https://site.bbmp.gov.in/contact.html', notes: 'Listed on the official BBMP contact page. Not confirmed as the receiving officer for a specific report.' },
    { label: 'Sahaaya 2.0 grievance information', website: 'https://bbmp.gov.in/', sourceUrl: 'https://bbmp.gov.in/', notes: 'The official authority homepage lists SAHAAYA 2.0 (Public Grievance); opening this link does not submit a complaint.' }
  ];
  for (const contact of contacts) await prisma.contactInfo.upsert({
    where: { id: `seed-${dept.id}-${contact.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}` },
    update: { ...contact, departmentId: dept.id, lastVerifiedAt: verified, verification: 'OFFICIAL_SOURCE' },
    create: { id: `seed-${dept.id}-${contact.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}`, departmentId: dept.id, ...contact, lastVerifiedAt: verified, verification: 'OFFICIAL_SOURCE' }
  });
  if (process.env.SEED_ADMIN_EMAIL && process.env.SEED_ADMIN_PASSWORD && process.env.SEED_ADMIN_PASSWORD.length >= 12 && Buffer.byteLength(process.env.SEED_ADMIN_PASSWORD, 'utf8') <= 72) {
    await prisma.user.upsert({ where: { email: process.env.SEED_ADMIN_EMAIL.toLowerCase() }, update: {}, create: { name: process.env.SEED_ADMIN_NAME || 'ResolveX Administrator', email: process.env.SEED_ADMIN_EMAIL.toLowerCase(), passwordHash: await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD, 12), role: 'ADMIN' } });
  }
  if (process.env.SEED_OFFICER_EMAIL && process.env.SEED_OFFICER_PASSWORD && process.env.SEED_OFFICER_PASSWORD.length >= 12 && Buffer.byteLength(process.env.SEED_OFFICER_PASSWORD, 'utf8') <= 72) {
    await prisma.user.upsert({ where: { email: process.env.SEED_OFFICER_EMAIL.toLowerCase() }, update: {}, create: { name: process.env.SEED_OFFICER_NAME || 'ResolveX Officer', email: process.env.SEED_OFFICER_EMAIL.toLowerCase(), passwordHash: await bcrypt.hash(process.env.SEED_OFFICER_PASSWORD, 12), role: 'OFFICER' } });
  }
  if (process.env.SEED_DEMO_REPORTS === 'true') {
    const reporter = await prisma.user.findFirst({ where: { role: 'ADMIN', isActive: true } });
    if (!reporter) {
      console.log('Demo reports skipped: create an admin account before seeding samples.');
    } else {
      const samples = [
        { trackingId: 'RX-DEMO-2026-001', category: 'Road / pothole damage', description: 'DEMO SAMPLE ONLY: Example pothole report near Example Park. No citizen submitted this report.', locationText: 'Demo location — Example Park, Bengaluru', status: 'In progress', sampleSeverity: 'Medium' },
        { trackingId: 'RX-DEMO-2026-002', category: 'Garbage / waste', description: 'DEMO SAMPLE ONLY: Example waste collection request for a fictional lane. No citizen submitted this report.', locationText: 'Demo location — Sample Layout, Bengaluru', status: 'Under review', sampleSeverity: 'Low' },
        { trackingId: 'RX-DEMO-2026-003', category: 'Streetlight / electrical', description: 'DEMO SAMPLE ONLY: Example report about a fictional streetlight. No citizen submitted this report.', locationText: 'Demo location — Practice Road, Bengaluru', status: 'Resolved', sampleSeverity: 'High' }
      ];
      for (const sample of samples) {
        const existing = await prisma.report.findUnique({ where: { trackingId: sample.trackingId } });
        const publicSummary = `DEMO SAMPLE: ${sample.category} example at ${sample.locationText.replace('Demo location — ', '')}. Fictional content; no citizen submitted this report.`;
        if (existing) {
          await prisma.report.update({ where: { id: existing.id }, data: { publicSummary, publicApproved: true, demo: true, severity: sample.sampleSeverity, aiSeverity: sample.sampleSeverity } });
          continue;
        }
        const { sampleSeverity, ...reportData } = sample;
        const report = await prisma.report.create({ data: { ...reportData, publicSummary, reporterId: reporter.id, departmentId: dept.id, publicApproved: true, demo: true, severity: sampleSeverity, aiSeverity: sampleSeverity, aiProvider: 'demo-seed', aiSummary: 'Demo sample; no AI analysis was run.', aiExplanation: 'This is fictional sample content for a product demonstration.' } });
        await prisma.statusHistory.create({ data: { reportId: report.id, actorId: reporter.id, status: report.status, note: 'DEMO DATA: fictional sample, not a citizen-submitted report.' } });
      }
      console.log('Seeded three clearly labelled public demo samples.');
    }
  }
  console.log('Seeded official Bengaluru civic directory and optional staff accounts.');
}

main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
