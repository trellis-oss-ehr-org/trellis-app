import { resolvePractice } from "./index";
import type { TemplateProps } from "./index";

export function TelehealthConsent({ content, practice: rawPractice }: TemplateProps) {
  const { client_name, date } = content;
  const practice = resolvePractice(rawPractice);

  return (
    <div className="prose prose-warm max-w-none">
      <h1 className="text-2xl font-display font-bold text-warm-800">
        Telehealth Informed Consent
      </h1>
      <p className="text-sm text-warm-500">
        {practice.practice_name}
      </p>

      <p>
        I, <strong>{client_name}</strong>, consent to participate in behavioral
        health services delivered via telehealth (audio/video technology) with{" "}
        {practice.practice_name}.
      </p>

      <h2 className="text-lg font-semibold text-warm-800 mt-6">
        What is Telehealth?
      </h2>
      <p className="text-sm text-warm-700">
        Telehealth involves the use of electronic communications to enable
        clinicians to provide services remotely. This may include assessment,
        therapy, psychoeducation, and care coordination conducted via secure
        video or audio platforms.
      </p>

      <h2 className="text-lg font-semibold text-warm-800 mt-6">
        Benefits &amp; Risks
      </h2>
      <p className="text-sm text-warm-700">
        <strong>Benefits</strong> may include increased access to care,
        convenience, and reduced travel time. <strong>Risks</strong> may include
        technology failures, reduced ability to perceive nonverbal cues, and
        potential privacy concerns related to electronic communication. In rare
        cases, telehealth may not be appropriate for your clinical needs, in
        which case your clinician will recommend in-person alternatives.
      </p>

      <h2 className="text-lg font-semibold text-warm-800 mt-6">
        Privacy &amp; Security
      </h2>
      <ul className="list-disc list-inside space-y-1 text-sm text-warm-700">
        <li>
          Sessions are conducted over HIPAA-compliant, encrypted platforms,
          which may include Google Meet or other secure video services.
        </li>
        <li>
          You should participate from a private location where others cannot
          overhear.
        </li>
        <li>
          With your consent, sessions may be recorded for clinical documentation
          purposes. Your clinician will confirm your preference before any
          recording begins. You may decline recording at any time without
          affecting your care.
        </li>
        <li>
          If your practice uses Google Workspace, telehealth sessions via
          Google Meet may be automatically recorded. Your clinician will inform
          you of this prior to the session.
        </li>
        <li>
          The same confidentiality protections that apply to in-person services
          apply to telehealth.
        </li>
      </ul>

      <h2 className="text-lg font-semibold text-warm-800 mt-6">
        AI-Assisted Documentation
      </h2>
      <p className="text-sm text-warm-700">
        Your clinician may use AI technology to assist with generating session
        notes from telehealth sessions. All AI-generated documentation is
        reviewed and approved by your clinician before becoming part of your
        clinical record.
      </p>

      <h2 className="text-lg font-semibold text-warm-800 mt-6">
        Emergency Protocols
      </h2>
      <p className="text-sm text-warm-700">
        Before beginning telehealth services, you will provide your physical
        location and a local emergency contact. If a clinical emergency occurs
        during a session, your clinician may need to contact emergency services
        at your location.
      </p>

      <h2 className="text-lg font-semibold text-warm-800 mt-6">
        Your Rights
      </h2>
      <ul className="list-disc list-inside space-y-1 text-sm text-warm-700">
        <li>
          You may withdraw consent and discontinue telehealth services at any
          time.
        </li>
        <li>
          You may request in-person services as an alternative when available.
        </li>
        <li>
          All other client rights outlined in the Informed Consent for Treatment
          apply equally to telehealth sessions.
        </li>
      </ul>

      <p className="mt-6 text-sm text-warm-600">
        By signing below on <strong>{date}</strong>, I confirm that I understand
        the nature, risks, and benefits of telehealth and consent to receiving
        services via telehealth technology.
      </p>
    </div>
  );
}
