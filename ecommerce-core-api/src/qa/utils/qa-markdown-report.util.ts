import type { QaRunReport } from '../qa-reports.service';

export function renderQaMarkdownReport(report: QaRunReport): string {
  const lines: string[] = [];
  lines.push(`# تقرير اختبار رحلة التاجر`);
  lines.push('');
  lines.push(`## معلومات الاختبار`);
  lines.push('');
  lines.push(`- الجولة: ${report.run.id}`);
  lines.push(`- السيناريو: ${report.run.scenarioTitle}`);
  lines.push(`- المختبر: ${report.run.testerName ?? '-'}`);
  lines.push(`- البيئة: ${report.run.environment ?? '-'}`);
  lines.push(`- الجهاز: ${report.run.deviceType ?? '-'}`);
  lines.push(`- المتصفح: ${report.run.browser ?? '-'}`);
  lines.push(`- إصدار البناء: ${report.run.buildVersion ?? '-'}`);
  lines.push(`- الحالة: ${report.run.status}`);
  lines.push('');
  lines.push(`## ملخص الجاهزية`);
  lines.push('');
  lines.push(`- درجة الجاهزية: ${report.score.finalScore}%`);
  lines.push(`- القرار: ${report.score.decision}`);
  lines.push(`- التقدم: ${report.progress.progressPercent}%`);
  lines.push(`- الفحوص الناجحة: ${report.progress.passCount}`);
  lines.push(`- الفحوص الفاشلة: ${report.progress.failCount}`);
  lines.push(`- الفحوص المحجوبة: ${report.progress.blockedCount}`);
  lines.push('');
  lines.push(`## تفصيل الدرجة`);
  lines.push('');
  lines.push(`| البند | القيمة |`);
  lines.push(`| --- | ---: |`);
  lines.push(`| الدرجة الأساسية | ${report.score.baseScore} |`);
  lines.push(`| عقوبة المشكلات | ${report.score.issuePenalty} |`);
  lines.push(`| عقوبة عدم الإكمال | ${report.score.completionPenalty} |`);
  lines.push(`| الدرجة النهائية | ${report.score.finalScore} |`);
  lines.push('');
  lines.push(`## ملخص المراحل`);
  lines.push('');
  lines.push(`| المرحلة | Pass | Fail | Blocked | N/A | متوسط التقييم |`);
  lines.push(`| --- | ---: | ---: | ---: | ---: | ---: |`);
  report.phases.forEach((phase) => {
    lines.push(
      `| ${phase.title} | ${phase.passCount} | ${phase.failCount} | ${phase.blockedCount} | ${phase.naCount} | ${phase.averageRating} |`,
    );
  });
  lines.push('');
  lines.push(`## المشكلات`);
  lines.push('');
  if (report.issues.items.length === 0) {
    lines.push(`لا توجد مشكلات مسجلة.`);
  } else {
    lines.push(`| العنوان | الشدة | التصنيف | حاجبة |`);
    lines.push(`| --- | --- | --- | --- |`);
    report.issues.items.forEach((issue) => {
      lines.push(
        `| ${issue.title} | ${issue.severity} | ${issue.category} | ${issue.isBlocking ? 'نعم' : 'لا'} |`,
      );
    });
  }
  lines.push('');
  lines.push(`## التوصيات`);
  lines.push('');
  report.recommendations.forEach((recommendation) => lines.push(`- ${recommendation}`));
  lines.push('');
  return lines.join('\n');
}
