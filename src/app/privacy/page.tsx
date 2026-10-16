import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BUSINESS_INFO } from "@/lib/business-info";

export const metadata: Metadata = {
  title: "Privacy Policy - SweptMind",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground mb-8 inline-flex items-center gap-1 text-sm transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to SweptMind
      </Link>

      <h1 className="mb-8 text-3xl font-bold">Privacy Policy</h1>
      <p className="text-muted-foreground mb-8 text-sm">Last updated: October 16, 2026</p>

      <div className="prose dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="mb-3 text-xl font-semibold">1. Introduction</h2>
          <p>
            SweptMind (&quot;we&quot;, &quot;our&quot;, &quot;the app&quot;) is a task management
            application. This Privacy Policy explains how we collect, use, and protect your personal
            information when you use our service at sweptmind.com and our native applications.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">2. Information We Collect</h2>

          <h3 className="mt-4 mb-2 text-lg font-medium">Account Information</h3>
          <p>
            When you create an account, we collect your name, email address, and profile picture. If
            you sign in with Google, we receive basic profile information from Google.
          </p>

          <h3 className="mt-4 mb-2 text-lg font-medium">Task Data</h3>
          <p>
            We store the tasks, lists, notes, tags, due dates, reminders, and other content you
            create within the app. This data is essential for providing the service.
          </p>

          <h3 className="mt-4 mb-2 text-lg font-medium">Location Data</h3>
          <p>
            If you enable location features, we use your location to show nearby tasks. Location
            data is processed on your device and is not stored on our servers. Saved locations
            (places you attach to tasks) are stored as part of your task data.
          </p>
          <p className="mt-2">
            In the Android app, if you turn on location reminders, the app uses your location in the
            background, even when the app is closed or not in use, to notify you when you are near a
            place attached to a task. This happens entirely on your device: your location is not
            sent to our servers or shared with anyone. You can turn location reminders off in
            Settings at any time.
          </p>

          <h3 className="mt-4 mb-2 text-lg font-medium">Google Contacts (Optional)</h3>
          <p>
            If you grant permission, we may access your Google Contacts in read-only mode to help
            you create tasks related to your contacts (e.g., phone call lists). We do not store,
            share, or transfer your contact data. It is fetched on demand and displayed only to you.
          </p>

          <h3 className="mt-4 mb-2 text-lg font-medium">Push Notifications</h3>
          <p>
            If you enable push notifications, we store a device token to deliver reminders. You can
            disable notifications at any time in Settings or in your device or browser settings.
          </p>

          <h3 className="mt-4 mb-2 text-lg font-medium">Payments</h3>
          <p>
            If you buy Premium by card, the payment is processed by Stripe; we never see or store
            your card details. For bank transfers we match incoming payments by their variable
            symbol.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">3. How We Use Your Information</h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>To provide, maintain, and improve the task management service</li>
            <li>To send you task reminders and due date notifications</li>
            <li>To sync your data across devices</li>
            <li>To authenticate your identity</li>
          </ul>
          <p className="mt-3">
            We do not sell your personal data. We do not use your data for advertising. We do not
            share your data with third parties except as described below.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">4. Third-Party Services</h2>
          <p>We use the following third-party services:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <strong>Hetzner</strong> &mdash; the server and database that run SweptMind
            </li>
            <li>
              <strong>Google OAuth</strong> &mdash; authentication (we receive your name, email, and
              profile picture)
            </li>
            <li>
              <strong>Google Calendar</strong> &mdash; bidirectional calendar synchronization (we
              create, read, update, and delete calendar events that correspond to your tasks)
            </li>
            <li>
              <strong>Firebase Cloud Messaging</strong> &mdash; push notification delivery
            </li>
            <li>
              <strong>Stripe</strong> &mdash; card payments for Premium
            </li>
            <li>
              <strong>OpenAI</strong> &mdash; optional AI features for Premium users (the text of
              the analyzed tasks is sent for processing; you can turn AI off in Settings)
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">5. Data Storage</h2>
          <p>
            Your data is stored in a PostgreSQL database on a server rented from Hetzner. Data is
            encrypted in transit (TLS). We retain your data for as long as your account is active;
            when you delete your account, your data is deleted immediately.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">6. Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Access your personal data</li>
            <li>Export your task data</li>
            <li>
              Delete your account and all associated data at any time in Settings (
              <Link href="/delete-account" className="text-primary underline">
                how to delete your account
              </Link>
              )
            </li>
            <li>Revoke Google access at any time</li>
            <li>Disable location tracking and push notifications</li>
          </ul>
          <p className="mt-3">
            To exercise these rights, contact us at{" "}
            <a href="mailto:info@sweptmind.com" className="text-primary underline">
              info@sweptmind.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">7. Cookies</h2>
          <p>
            We use essential cookies for authentication and language preferences. We do not use
            tracking or advertising cookies.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">8. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of significant
            changes via the app or email.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">9. Contact</h2>
          <p>
            If you have questions about this Privacy Policy, contact us at{" "}
            <a href="mailto:info@sweptmind.com" className="text-primary underline">
              info@sweptmind.com
            </a>
            .
          </p>
          <p className="mt-2">
            {BUSINESS_INFO.name}
            <br />
            {BUSINESS_INFO.address}, Czech Republic
            <br />
            Company ID (IČO): {BUSINESS_INFO.businessId}, VAT ID: {BUSINESS_INFO.vatId}
          </p>
        </section>
      </div>
    </div>
  );
}
