import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service - SweptMind",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground mb-8 inline-flex items-center gap-1 text-sm transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to SweptMind
      </Link>

      <h1 className="mb-8 text-3xl font-bold">Terms of Service</h1>
      <p className="text-muted-foreground mb-8 text-sm">Last updated: March 16, 2026</p>

      <div className="prose dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="mb-3 text-xl font-semibold">1. Acceptance of Terms</h2>
          <p>
            By accessing or using SweptMind (&quot;the app&quot;, &quot;the service&quot;), you
            agree to be bound by these Terms of Service. If you do not agree to these terms, do not
            use the service.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">2. Description of Service</h2>
          <p>
            SweptMind is a task management application that helps you organize tasks, set reminders,
            and synchronize with external calendars. The service is available via web browser,
            mobile applications, and desktop applications.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">3. User Accounts</h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>You must provide accurate information when creating an account.</li>
            <li>You are responsible for maintaining the security of your account credentials.</li>
            <li>You must be at least 16 years old to use the service.</li>
            <li>One person may not maintain more than one account.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">4. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Use the service for any unlawful purpose</li>
            <li>Attempt to gain unauthorized access to the service or its systems</li>
            <li>Interfere with or disrupt the service or servers</li>
            <li>Use automated tools to scrape or access the service without permission</li>
            <li>Upload malicious content or code</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">5. Your Data</h2>
          <p>
            You retain ownership of all content you create within SweptMind (tasks, lists, notes,
            etc.). By using the service, you grant us a limited license to store, process, and
            display your content solely for the purpose of providing the service to you.
          </p>
          <p className="mt-3">
            We handle your personal data in accordance with our{" "}
            <Link href="/privacy" className="text-primary underline">
              Privacy Policy
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">6. Third-Party Integrations</h2>
          <p>
            SweptMind integrates with third-party services such as Google Calendar, Google Contacts,
            and Facebook Login. When you connect these services:
          </p>
          <ul className="list-disc space-y-1 pl-6">
            <li>You authorize SweptMind to access data from those services as described</li>
            <li>Your use of third-party services is subject to their own terms and policies</li>
            <li>You can disconnect third-party services at any time in Settings</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">7. Service Availability</h2>
          <p>
            We strive to keep SweptMind available at all times, but we do not guarantee
            uninterrupted access. The service may be temporarily unavailable due to maintenance,
            updates, or circumstances beyond our control. We are not liable for any loss resulting
            from service downtime.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">8. Limitation of Liability</h2>
          <p>
            SweptMind is provided &quot;as is&quot; without warranties of any kind, either express
            or implied. To the maximum extent permitted by law, we shall not be liable for any
            indirect, incidental, special, or consequential damages arising from your use of the
            service.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">9. Termination</h2>
          <p>
            You may delete your account at any time. We may suspend or terminate your access if you
            violate these terms. Upon termination, your data will be deleted in accordance with our
            Privacy Policy.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">10. Changes to Terms</h2>
          <p>
            We may update these Terms of Service from time to time. We will notify you of
            significant changes via the app or email. Continued use of the service after changes
            constitutes acceptance of the updated terms.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">11. Governing Law</h2>
          <p>
            These terms are governed by the laws of the Czech Republic. Any disputes shall be
            resolved in the courts of the Czech Republic.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">12. Contact</h2>
          <p>
            If you have questions about these Terms of Service, contact us at{" "}
            <a href="mailto:info@sweptmind.com" className="text-primary underline">
              info@sweptmind.com
            </a>
            .
          </p>
          <p className="mt-2">
            Martin Zadrazil
            <br />
            Prague, Czech Republic
          </p>
        </section>
      </div>
    </div>
  );
}
