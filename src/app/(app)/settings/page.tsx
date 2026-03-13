"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { gql } from "@apollo/client";
import { useMutation, useQuery, useApolloClient } from "@apollo/client/react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  Settings,
  Moon,
  Sun,
  Monitor,
  Upload,
  FileUp,
  Check,
  AlertCircle,
  Copy,
  RefreshCw,
} from "lucide-react";
import { useSidebarContext } from "@/components/layout/app-shell";
import { useTaskCountMode } from "@/hooks/use-task-count-mode";
import { useNewTaskPosition } from "@/hooks/use-new-task-position";
import { useLocale } from "@/hooks/use-locale";
import { useTranslations } from "@/lib/i18n";
import { parseCSV, mapOutlookTaskRow, type MappedTask } from "@/lib/csv-import";
import { getPlatform, getPushAdapter } from "@sweptmind/native-bridge";

const IMPORT_TASKS = gql`
  mutation ImportTasks($input: [ImportTaskInput!]!) {
    importTasks(input: $input) {
      importedCount
      createdLists
    }
  }
`;

const GET_CALENDAR_TOKEN = gql`
  mutation GetCalendarToken {
    getCalendarToken
  }
`;

const REGENERATE_CALENDAR_TOKEN = gql`
  mutation RegenerateCalendarToken {
    regenerateCalendarToken
  }
`;

const UPDATE_CALENDAR_SYNC_ALL = gql`
  mutation UpdateCalendarSyncAll($syncAll: Boolean!) {
    updateCalendarSyncAll(syncAll: $syncAll)
  }
`;

const CALENDAR_SYNC_ALL = gql`
  query CalendarSyncAll {
    calendarSyncAll
  }
`;

interface ImportTasksData {
  importTasks: {
    importedCount: number;
    createdLists: string[];
  };
}

interface GetCalendarTokenData {
  getCalendarToken: string;
}

interface RegenerateCalendarTokenData {
  regenerateCalendarToken: string;
}

interface CalendarSyncAllData {
  calendarSyncAll: boolean;
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { mode: taskCountMode, setMode: setTaskCountMode } = useTaskCountMode();
  const { position: newTaskPosition, setPosition: setNewTaskPosition } = useNewTaskPosition();
  const { locale, setLocale } = useLocale();
  const { t } = useTranslations();
  const { open: openSidebar, isDesktop } = useSidebarContext();
  const apolloClient = useApolloClient();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<MappedTask[] | null>(null);
  const [importResult, setImportResult] = useState<{ count: number; lists: string[] } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const [importTasks, { loading: importing }] = useMutation<ImportTasksData>(IMPORT_TASKS);

  // Calendar state
  const [calendarToken, setCalendarToken] = useState<string | null>(null);
  const [calendarTokenLoading, setCalendarTokenLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [icsCopied, setIcsCopied] = useState(false);

  const [getToken] = useMutation<GetCalendarTokenData>(GET_CALENDAR_TOKEN);
  const [regenerateToken] = useMutation<RegenerateCalendarTokenData>(REGENERATE_CALENDAR_TOKEN);
  const [updateSyncAllMutation] = useMutation(UPDATE_CALENDAR_SYNC_ALL);
  const { data: syncAllData } = useQuery<CalendarSyncAllData>(CALENDAR_SYNC_ALL);

  const syncAll = syncAllData?.calendarSyncAll ?? false;

  // Push notification state
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState(true);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [notifyDueDate, setNotifyDueDate] = useState(true);
  const [notifyReminder, setNotifyReminder] = useState(true);

  useEffect(() => {
    const platform = getPlatform();

    // Electron doesn't support Web Push (no push service available)
    if (platform === "electron") {
      setPushSupported(false);
      return;
    }

    if (platform === "ios" || platform === "android") {
      setPushSupported(true);
      fetch("/api/push/preferences")
        .then((r) => r.json())
        .then((prefs) => {
          setPushEnabled(true);
          if (typeof prefs.notifyDueDate === "boolean") setNotifyDueDate(prefs.notifyDueDate);
          if (typeof prefs.notifyReminder === "boolean") setNotifyReminder(prefs.notifyReminder);
        })
        .catch(() => setPushEnabled(false));
      return;
    }

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushSupported(false);
      return;
    }
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setPushEnabled(!!sub);
        if (sub) {
          fetch("/api/push/preferences")
            .then((r) => r.json())
            .then((prefs) => {
              if (typeof prefs.notifyDueDate === "boolean") setNotifyDueDate(prefs.notifyDueDate);
              if (typeof prefs.notifyReminder === "boolean")
                setNotifyReminder(prefs.notifyReminder);
            })
            .catch(() => {});
        }
      });
    });
  }, []);

  const handlePrefChange = useCallback(
    async (key: "notifyDueDate" | "notifyReminder", checked: boolean) => {
      if (key === "notifyDueDate") setNotifyDueDate(checked);
      else setNotifyReminder(checked);
      try {
        await fetch("/api/push/preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [key]: checked }),
        });
      } catch {
        // Revert on failure
        if (key === "notifyDueDate") setNotifyDueDate(!checked);
        else setNotifyReminder(!checked);
      }
    },
    [],
  );

  const handlePushToggle = useCallback(async (checked: boolean) => {
    setPushLoading(true);
    setPushError(null);
    try {
      const platform = getPlatform();

      if (checked) {
        if (platform === "ios" || platform === "android") {
          const pushAdapter = getPushAdapter();
          const { token, platform: detectedPlatform } = await pushAdapter.register();
          await fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              endpoint: token,
              platform: detectedPlatform,
            }),
          });
        } else {
          const permission = await Notification.requestPermission();
          if (permission !== "granted") {
            setPushError(t("push.permissionDenied"));
            setPushLoading(false);
            return;
          }
          // Timeout to prevent hanging if service worker never activates
          const reg = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("timeout")), 10_000),
            ),
          ]);
          const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
          });
          await fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(sub.toJSON()),
          });
        }
        setPushEnabled(true);
      } else {
        if (platform === "ios" || platform === "android") {
          const pushAdapter = getPushAdapter();
          await pushAdapter.unregister();
        } else {
          const reg = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("timeout")), 10_000),
            ),
          ]);
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            await fetch("/api/push/unsubscribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ endpoint: sub.endpoint }),
            });
            await sub.unsubscribe();
          }
        }
        setPushEnabled(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      setPushError(msg === "timeout" ? t("push.swUnavailable") : t("push.error"));
    } finally {
      setPushLoading(false);
    }
  }, [t]);

  useEffect(() => {
    getToken()
      .then(({ data }) => {
        if (data?.getCalendarToken) setCalendarToken(data.getCalendarToken);
      })
      .finally(() => setCalendarTokenLoading(false));
  }, [getToken]);

  const caldavUrl = calendarToken
    ? `${window.location.origin}/api/caldav/${calendarToken}/calendars/tasks/`
    : "";

  const icsFeedUrl = calendarToken
    ? `${window.location.origin}/api/calendar/${calendarToken}/feed.ics`
    : "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(caldavUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleIcsCopy = async () => {
    await navigator.clipboard.writeText(icsFeedUrl);
    setIcsCopied(true);
    setTimeout(() => setIcsCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    if (!confirm(t("calendar.regenerateConfirm"))) return;
    const { data } = await regenerateToken();
    if (data?.regenerateCalendarToken) setCalendarToken(data.regenerateCalendarToken);
  };

  const handleSyncAllToggle = async (checked: boolean) => {
    // Optimistic update — toggle UI immediately
    apolloClient.cache.writeQuery({
      query: CALENDAR_SYNC_ALL,
      data: { calendarSyncAll: checked },
    });
    try {
      await updateSyncAllMutation({ variables: { syncAll: checked } });
    } catch {
      // Revert on failure
      apolloClient.cache.writeQuery({
        query: CALENDAR_SYNC_ALL,
        data: { calendarSyncAll: !checked },
      });
    }
  };

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const { rows } = parseCSV(text);
      const mapped = rows.map(mapOutlookTaskRow).filter((r): r is MappedTask => r !== null);

      if (mapped.length === 0) {
        setImportError(t("settings.importEmpty"));
        setPreview(null);
      } else {
        setPreview(mapped);
      }
    };
    reader.readAsText(file);
    // Reset the input so the same file can be re-selected
    e.target.value = "";
  }

  async function handleImport() {
    if (!preview || preview.length === 0) return;

    try {
      const { data } = await importTasks({
        variables: {
          input: preview.map((t) => ({
            title: t.title,
            dueDate: t.dueDate,
            notes: t.notes,
            isCompleted: t.isCompleted,
            listName: t.listName,
          })),
        },
      });
      // Bulk import creates many tasks/lists — refetch all active queries
      await apolloClient.refetchQueries({ include: "active" });

      if (data) {
        setImportResult({
          count: data.importTasks.importedCount,
          lists: data.importTasks.createdLists,
        });
        setPreview(null);
      }
    } catch {
      setImportError(t("settings.importError"));
    }
  }

  const uniqueLists = preview
    ? [...new Set(preview.map((t) => t.listName).filter((n): n is string => !!n))]
    : [];

  return (
    <div className="flex flex-1 flex-col overflow-auto p-8">
      <h1 className="mb-8 flex items-center gap-2 text-2xl font-bold">
        {!isDesktop && (
          <Button variant="ghost" size="icon" onClick={openSidebar} className="-ml-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <Settings className="h-7 w-7" />
        {t("settings.title")}
      </h1>

      <div className="max-w-md space-y-6">
        <div>
          <h2 className="mb-3 text-lg font-semibold">{t("settings.appearance")}</h2>
          <div className="flex gap-2">
            <Button
              variant={theme === "light" ? "default" : "outline"}
              onClick={() => setTheme("light")}
              className="gap-2"
            >
              <Sun className="h-4 w-4" />
              {t("settings.light")}
            </Button>
            <Button
              variant={theme === "dark" ? "default" : "outline"}
              onClick={() => setTheme("dark")}
              className="gap-2"
            >
              <Moon className="h-4 w-4" />
              {t("settings.dark")}
            </Button>
            <Button
              variant={theme === "system" ? "default" : "outline"}
              onClick={() => setTheme("system")}
              className="gap-2"
            >
              <Monitor className="h-4 w-4" />
              {t("settings.system")}
            </Button>
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-lg font-semibold">{t("settings.taskCount")}</h2>
          <p className="text-muted-foreground mb-3 text-sm">{t("settings.taskCountDesc")}</p>
          <div className="flex gap-2">
            <Button
              variant={taskCountMode === "all" ? "default" : "outline"}
              onClick={() => setTaskCountMode("all")}
            >
              {t("settings.allIncomplete")}
            </Button>
            <Button
              variant={taskCountMode === "visible" ? "default" : "outline"}
              onClick={() => setTaskCountMode("visible")}
            >
              {t("settings.onlyVisible")}
            </Button>
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-lg font-semibold">{t("settings.newTaskPosition")}</h2>
          <p className="text-muted-foreground mb-3 text-sm">{t("settings.newTaskPositionDesc")}</p>
          <div className="flex gap-2">
            <Button
              variant={newTaskPosition === "top" ? "default" : "outline"}
              onClick={() => setNewTaskPosition("top")}
            >
              {t("settings.newTaskTop")}
            </Button>
            <Button
              variant={newTaskPosition === "bottom" ? "default" : "outline"}
              onClick={() => setNewTaskPosition("bottom")}
            >
              {t("settings.newTaskBottom")}
            </Button>
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-lg font-semibold">{t("settings.language")}</h2>
          <div className="flex gap-2">
            <Button
              variant={locale === "cs" ? "default" : "outline"}
              onClick={() => setLocale("cs")}
            >
              Čeština
            </Button>
            <Button
              variant={locale === "en" ? "default" : "outline"}
              onClick={() => setLocale("en")}
            >
              English
            </Button>
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-lg font-semibold">{t("settings.importTitle")}</h2>
          <p className="text-muted-foreground mb-3 text-sm">{t("settings.importDescription")}</p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileSelect}
          />

          {!preview && !importResult && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              {t("settings.importButton")}
            </Button>
          )}

          {importError && (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {importError}
            </div>
          )}

          {preview && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <span className="flex items-center gap-1">
                  <FileUp className="h-4 w-4" />
                  {t("settings.importTaskCount", { count: String(preview.length) })}
                </span>
                {uniqueLists.length > 0 && (
                  <span className="text-muted-foreground">
                    {t("settings.importListCount", { count: String(uniqueLists.length) })}
                  </span>
                )}
              </div>

              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-3 py-2 text-left font-medium">Title</th>
                      <th className="px-3 py-2 text-left font-medium">Due Date</th>
                      <th className="px-3 py-2 text-left font-medium">List</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 5).map((task, i) => (
                      <tr key={i} className="border-b last:border-b-0">
                        <td className="px-3 py-2">
                          <span className={task.isCompleted ? "line-through opacity-50" : ""}>
                            {task.title}
                          </span>
                        </td>
                        <td className="text-muted-foreground px-3 py-2">{task.dueDate ?? "—"}</td>
                        <td className="text-muted-foreground px-3 py-2">{task.listName ?? "—"}</td>
                      </tr>
                    ))}
                    {preview.length > 5 && (
                      <tr>
                        <td colSpan={3} className="text-muted-foreground px-3 py-2 text-center">
                          +{preview.length - 5} ...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleImport} disabled={importing} className="gap-2">
                  {importing ? t("settings.importing") : t("settings.importConfirm")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setPreview(null);
                    setImportError(null);
                  }}
                >
                  {t("lists.cancel")}
                </Button>
              </div>
            </div>
          )}

          {importResult && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400">
                <Check className="h-4 w-4 shrink-0" />
                {t("settings.importSuccess", { count: String(importResult.count) })}
              </div>
              {importResult.lists.length > 0 && (
                <p className="text-muted-foreground text-sm">
                  {t("settings.importListCount", { count: String(importResult.lists.length) })}:{" "}
                  {importResult.lists.join(", ")}
                </p>
              )}
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  setImportResult(null);
                  fileInputRef.current?.click();
                }}
              >
                <Upload className="h-4 w-4" />
                {t("settings.importButton")}
              </Button>
            </div>
          )}
        </div>

        {/* Push Notifications */}
        <div>
          <h2 className="mb-3 text-lg font-semibold">{t("push.title")}</h2>
          <p className="text-muted-foreground mb-3 text-xs">{t("push.description")}</p>
          {pushSupported ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm">{pushEnabled ? t("push.enabled") : t("push.disabled")}</p>
                <Switch
                  checked={pushEnabled}
                  onCheckedChange={handlePushToggle}
                  disabled={pushLoading}
                />
              </div>
              {pushError && (
                <p className="text-sm text-red-500">{pushError}</p>
              )}
              {pushEnabled && (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-muted-foreground text-sm">{t("push.notifyDueDate")}</p>
                    <Switch
                      checked={notifyDueDate}
                      onCheckedChange={(checked) => handlePrefChange("notifyDueDate", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-muted-foreground text-sm">{t("push.notifyReminder")}</p>
                    <Switch
                      checked={notifyReminder}
                      onCheckedChange={(checked) => handlePrefChange("notifyReminder", checked)}
                    />
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">{t("push.unsupported")}</p>
          )}
        </div>

        {/* Calendar */}
        <div>
          <h2 className="mb-3 text-lg font-semibold">{t("calendar.title")}</h2>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("calendar.caldavUrl")}</label>
            <p className="text-muted-foreground text-xs">{t("calendar.caldavDescription")}</p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={calendarTokenLoading ? t("calendar.generating") : caldavUrl}
                className="bg-muted flex-1 rounded-md border px-3 py-2 text-sm"
              />
              <Button variant="outline" size="icon" onClick={handleCopy} disabled={!calendarToken}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <label className="text-sm font-medium">{t("calendar.icsFeedUrl")}</label>
            <p className="text-muted-foreground text-xs">{t("calendar.icsFeedDescription")}</p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={calendarTokenLoading ? t("calendar.generating") : icsFeedUrl}
                className="bg-muted flex-1 rounded-md border px-3 py-2 text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleIcsCopy}
                disabled={!calendarToken}
              >
                {icsCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={handleRegenerate}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("calendar.regenerateToken")}
            </Button>
          </div>
          <div className="mt-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{t("calendar.syncAllLabel")}</p>
              <p className="text-muted-foreground text-xs">{t("calendar.syncAllDescription")}</p>
            </div>
            <Switch checked={syncAll} onCheckedChange={handleSyncAllToggle} />
          </div>
        </div>
      </div>

      <div className="text-muted-foreground mt-12 max-w-md border-t pt-4 text-xs">
        <p>
          SweptMind &middot; {getPlatform()} &middot; Build{" "}
          {process.env.NEXT_PUBLIC_BUILD_ID ?? "dev"}
          {process.env.NEXT_PUBLIC_BUILD_TIME &&
            ` (${new Date(process.env.NEXT_PUBLIC_BUILD_TIME).toLocaleString()})`}
        </p>
      </div>
    </div>
  );
}
