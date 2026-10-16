"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, MapPin } from "lucide-react";
import { getLocationAdapter, type LocationPermissions } from "@sweptmind/native-bridge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTranslations } from "@/lib/i18n";
import { nativePreferences, useLocationRemindersEnabled } from "@/lib/native-preferences";

/**
 * Android app only: opt-in for OS geofence notifications. Switching it on first shows the
 * prominent disclosure Google Play requires right before asking for background location.
 */
export function LocationRemindersSection() {
  const { t } = useTranslations();
  const enabled = useLocationRemindersEnabled();
  const [permissions, setPermissions] = useState<LocationPermissions | null>(null);
  const [loading, setLoading] = useState(false);
  const [disclosureOpen, setDisclosureOpen] = useState(false);

  const refreshPermissions = useCallback(() => {
    getLocationAdapter()
      .getPermissionStatus()
      .then(setPermissions)
      .catch(() => setPermissions(null));
  }, []);

  // Re-check when the user comes back from the system settings
  useEffect(() => {
    refreshPermissions();
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshPermissions();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshPermissions]);

  const handleToggle = useCallback((checked: boolean) => {
    if (checked) {
      setDisclosureOpen(true);
    } else {
      // useGeofenceSync removes the registered geofences
      nativePreferences.setLocationRemindersEnabled(false);
    }
  }, []);

  const enableAfterDisclosure = useCallback(async () => {
    setDisclosureOpen(false);
    setLoading(true);
    try {
      const result = await getLocationAdapter().requestAlwaysPermission();
      setPermissions(result);
      if (result.location === "denied" || result.location === "notDetermined") return;
      nativePreferences.setLocationRemindersEnabled(true);
    } catch (err) {
      console.warn("[geofence] enabling failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const warning = (() => {
    if (!permissions) return null;
    if (permissions.location === "denied") return t("locationReminders.denied");
    if (!enabled) return null;
    if (permissions.location === "whenInUse") return t("locationReminders.needsAlways");
    if (permissions.notifications === "denied") return t("locationReminders.notificationsDenied");
    return null;
  })();

  return (
    <div>
      <h2 className="mb-1 text-sm font-semibold">
        <MapPin className="mr-2 inline h-4 w-4" />
        {t("locationReminders.title")}
      </h2>
      <p className="text-muted-foreground mb-3 text-xs">{t("locationReminders.description")}</p>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm">
            {enabled ? t("locationReminders.enabled") : t("locationReminders.disabled")}
          </p>
          <Switch checked={enabled} onCheckedChange={handleToggle} disabled={loading} />
        </div>
        <AlertDialog open={disclosureOpen} onOpenChange={setDisclosureOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("locationReminders.disclosureTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("locationReminders.disclosureBody")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("locationReminders.disclosureDecline")}</AlertDialogCancel>
              <AlertDialogAction onClick={enableAfterDisclosure}>
                {t("locationReminders.disclosureAccept")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {warning && (
          <div className="space-y-2">
            <p className="text-sm text-amber-600 dark:text-amber-500">{warning}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => getLocationAdapter().openAppSettings()}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              {t("push.openAppSettings")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
