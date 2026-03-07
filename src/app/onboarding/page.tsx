"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import {
  Briefcase,
  Car,
  CheckCircle2,
  Clock,
  Home,
  Lightbulb,
  List,
  MapPin,
  Monitor,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useTranslations } from "@/lib/i18n";
import { useGeocode } from "@/hooks/use-geocode";

const COMPLETE_ONBOARDING = gql`
  mutation CompleteOnboarding($input: CompleteOnboardingInput!) {
    completeOnboarding(input: $input)
  }
`;

const SKIP_ONBOARDING = gql`
  mutation SkipOnboarding {
    skipOnboarding
  }
`;

interface LocationData {
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
}

const LIST_DEFS = [
  {
    key: "home",
    i18nKey: "listHome" as const,
    icon: Home,
    iconKey: "home",
    deviceContext: null,
    hasLocation: true,
    indicator: "green" as const,
  },
  {
    key: "work",
    i18nKey: "listWork" as const,
    icon: Briefcase,
    iconKey: "briefcase",
    deviceContext: null,
    hasLocation: true,
    indicator: "green" as const,
  },
  {
    key: "computer",
    i18nKey: "listComputer" as const,
    icon: Monitor,
    iconKey: "monitor",
    deviceContext: "computer",
    hasLocation: false,
    indicator: "yellow" as const,
  },
  {
    key: "phoneCalls",
    i18nKey: "listPhoneCalls" as const,
    icon: Smartphone,
    iconKey: "smartphone",
    deviceContext: "phone",
    hasLocation: false,
    indicator: "yellow" as const,
  },
  {
    key: "errands",
    i18nKey: "listErrands" as const,
    icon: Car,
    iconKey: "car",
    deviceContext: null,
    hasLocation: false,
    indicator: null,
  },
  {
    key: "waitingFor",
    i18nKey: "listWaitingFor" as const,
    icon: Clock,
    iconKey: "clock",
    deviceContext: null,
    hasLocation: false,
    indicator: null,
  },
  {
    key: "somedayMaybe",
    i18nKey: "listSomedayMaybe" as const,
    icon: Lightbulb,
    iconKey: "lightbulb",
    deviceContext: null,
    hasLocation: false,
    indicator: null,
  },
  {
    key: "other",
    i18nKey: "listOther" as const,
    icon: List,
    iconKey: "list",
    deviceContext: null,
    hasLocation: false,
    indicator: null,
  },
] as const;

type ListKey = (typeof LIST_DEFS)[number]["key"];

export default function OnboardingPage() {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const { t } = useTranslations();
  const [step, setStep] = useState(0);
  const [selectedLists, setSelectedLists] = useState<Record<ListKey, boolean>>({
    home: true,
    work: true,
    computer: true,
    phoneCalls: true,
    errands: true,
    waitingFor: true,
    somedayMaybe: true,
    other: true,
  });
  const [homeLocation, setHomeLocation] = useState<LocationData | null>(null);
  const [workLocation, setWorkLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(false);

  const [completeOnboarding] = useMutation(COMPLETE_ONBOARDING);
  const [skipOnboarding] = useMutation(SKIP_ONBOARDING);

  async function handleSkip() {
    setLoading(true);
    try {
      await skipOnboarding();
      await updateSession({});
      router.push("/planned");
      router.refresh();
    } catch {
      setLoading(false);
    }
  }

  async function handleComplete() {
    setLoading(true);
    try {
      const lists = LIST_DEFS.filter((def) => selectedLists[def.key]).map((def) => ({
        name: t(`onboarding.${def.i18nKey}`),
        icon: def.iconKey,
        deviceContext: def.deviceContext,
        location:
          def.key === "home" && homeLocation
            ? homeLocation
            : def.key === "work" && workLocation
              ? workLocation
              : null,
      }));

      await completeOnboarding({ variables: { input: { lists } } });
      await updateSession({});
      router.push("/planned");
      router.refresh();
    } catch {
      setLoading(false);
    }
  }

  // Calculate which steps are active based on selection
  function getNextStep(currentStep: number): number {
    if (currentStep === 0) return 1; // intro → lists
    if (currentStep === 1) {
      if (selectedLists.home) return 2; // lists → home location
      if (selectedLists.work) return 3; // lists → work location
      return 4; // lists → done
    }
    if (currentStep === 2) {
      if (selectedLists.work) return 3; // home → work location
      return 4; // home → done
    }
    if (currentStep === 3) return 4; // work → done
    return currentStep + 1;
  }

  function getTotalSteps(): number {
    let count = 3; // intro + lists + done
    if (selectedLists.home) count++;
    if (selectedLists.work) count++;
    return count;
  }

  function getCurrentStepNumber(): number {
    if (step === 0) return 1;
    if (step === 1) return 2;
    if (step === 2) return 3;
    if (step === 3) return selectedLists.home ? 4 : 3;
    if (step === 4) return getTotalSteps();
    return step + 1;
  }

  return (
    <Card className="w-full max-w-lg">
      {step > 0 && step < 4 && (
        <div className="text-muted-foreground px-6 pt-4 text-center text-xs">
          {t("onboarding.step", {
            current: String(getCurrentStepNumber()),
            total: String(getTotalSteps()),
          })}
        </div>
      )}

      {step === 0 && <StepIntro onStart={() => setStep(1)} onSkip={handleSkip} loading={loading} />}
      {step === 1 && (
        <StepLists
          selectedLists={selectedLists}
          onToggle={(key) => setSelectedLists((prev) => ({ ...prev, [key]: !prev[key] }))}
          onContinue={() => setStep(getNextStep(1))}
          onSkip={handleSkip}
          loading={loading}
        />
      )}
      {step === 2 && (
        <StepLocation
          type="home"
          location={homeLocation}
          onSelect={setHomeLocation}
          onContinue={() => setStep(getNextStep(2))}
          onSkip={() => setStep(getNextStep(2))}
          loading={loading}
          preSelectCurrent
        />
      )}
      {step === 3 && (
        <StepLocation
          type="work"
          location={workLocation}
          onSelect={setWorkLocation}
          onContinue={() => setStep(getNextStep(3))}
          onSkip={() => setStep(getNextStep(3))}
          loading={loading}
        />
      )}
      {step === 4 && (
        <StepDone
          selectedCount={LIST_DEFS.filter((d) => selectedLists[d.key]).length}
          onFinish={handleComplete}
          loading={loading}
        />
      )}
    </Card>
  );
}

function StepIntro({
  onStart,
  onSkip,
  loading,
}: {
  onStart: () => void;
  onSkip: () => void;
  loading: boolean;
}) {
  const { t } = useTranslations();

  return (
    <>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <CardTitle className="text-2xl">{t("onboarding.introTitle")}</CardTitle>
        <CardDescription>{t("onboarding.introDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button onClick={onStart} className="w-full" disabled={loading}>
          {t("onboarding.introStart")}
        </Button>
        <Button variant="ghost" onClick={onSkip} className="w-full" disabled={loading}>
          {t("onboarding.introSkip")}
        </Button>
      </CardContent>
    </>
  );
}

function StepLists({
  selectedLists,
  onToggle,
  onContinue,
  onSkip,
  loading,
}: {
  selectedLists: Record<ListKey, boolean>;
  onToggle: (key: ListKey) => void;
  onContinue: () => void;
  onSkip: () => void;
  loading: boolean;
}) {
  const { t } = useTranslations();

  return (
    <>
      <CardHeader className="text-center">
        <CardTitle>{t("onboarding.listsTitle")}</CardTitle>
        <CardDescription>{t("onboarding.listsDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          {LIST_DEFS.map((def) => {
            const Icon = def.icon;
            return (
              <label
                key={def.key}
                className="hover:bg-accent flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 transition-colors"
              >
                <Checkbox
                  checked={selectedLists[def.key]}
                  onCheckedChange={() => onToggle(def.key)}
                  className="rounded-sm"
                />
                <Icon className="h-5 w-5 text-blue-500" />
                <span className="flex-1 text-sm font-medium">{t(`onboarding.${def.i18nKey}`)}</span>
                {def.indicator === "green" && <MapPin className="h-3 w-3 text-green-500" />}
                {def.indicator === "yellow" && def.deviceContext === "computer" && (
                  <Monitor className="h-3 w-3 text-yellow-500" />
                )}
                {def.indicator === "yellow" && def.deviceContext === "phone" && (
                  <Smartphone className="h-3 w-3 text-yellow-500" />
                )}
              </label>
            );
          })}
        </div>
        <div className="flex flex-col gap-2">
          <Button
            onClick={onContinue}
            className="w-full"
            disabled={loading || !Object.values(selectedLists).some(Boolean)}
          >
            {t("onboarding.listsContinue")}
          </Button>
          <Button variant="ghost" onClick={onSkip} className="w-full" disabled={loading}>
            {t("onboarding.listsSkip")}
          </Button>
        </div>
      </CardContent>
    </>
  );
}

function StepLocation({
  type,
  location,
  onSelect,
  onContinue,
  onSkip,
  loading,
  preSelectCurrent,
}: {
  type: "home" | "work";
  location: LocationData | null;
  onSelect: (loc: LocationData) => void;
  onContinue: () => void;
  onSkip: () => void;
  loading: boolean;
  preSelectCurrent?: boolean;
}) {
  const { t, locale } = useTranslations();
  const geocode = useGeocode({ locale });
  const [search, setSearch] = useState("");
  const [geoLoading, setGeoLoading] = useState(false);

  // Pre-select current location for home
  useEffect(() => {
    if (!preSelectCurrent || location) return;
    if (!("geolocation" in navigator)) return;

    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onSelect({
          name: t("onboarding.currentLocation"),
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          address: null,
        });
        setGeoLoading(false);
      },
      () => setGeoLoading(false),
      { timeout: 5000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preSelectCurrent]);

  function handleSelectResult(result: { display_name: string; lat: string; lon: string }) {
    onSelect({
      name: result.display_name.split(",")[0],
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      address: result.display_name,
    });
    setSearch("");
    geocode.clear();
  }

  const isHome = type === "home";

  return (
    <>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <MapPin className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <CardTitle>{isHome ? t("onboarding.homeTitle") : t("onboarding.workTitle")}</CardTitle>
        <CardDescription>
          {isHome ? t("onboarding.homeDescription") : t("onboarding.workDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {location && (
          <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2.5 dark:bg-emerald-950/30">
            <MapPin className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium">{location.name}</span>
            {location.address && (
              <span className="text-muted-foreground truncate text-xs">{location.address}</span>
            )}
          </div>
        )}

        {geoLoading && (
          <div className="text-muted-foreground animate-pulse text-center text-sm">
            {t("common.loading")}
          </div>
        )}

        <Command shouldFilter={false} className="rounded-lg border">
          <CommandInput
            placeholder={t("onboarding.searchLocation")}
            value={search}
            onValueChange={(val) => {
              setSearch(val);
              geocode.search(val);
            }}
          />
          <CommandList>
            <CommandEmpty />
            {geocode.results.length > 0 && (
              <CommandGroup heading={t("tasks.searchResults")}>
                {geocode.results.map((result) => (
                  <CommandItem
                    key={`${result.lat}-${result.lon}`}
                    onSelect={() => handleSelectResult(result)}
                  >
                    <MapPin className="mr-2 h-3 w-3" />
                    <span className="truncate">{result.display_name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>

        <div className="flex flex-col gap-2">
          <Button onClick={onContinue} className="w-full" disabled={loading}>
            {isHome ? t("onboarding.homeContinue") : t("onboarding.workContinue")}
          </Button>
          <Button variant="ghost" onClick={onSkip} className="w-full" disabled={loading}>
            {isHome ? t("onboarding.homeSkip") : t("onboarding.workSkip")}
          </Button>
        </div>
      </CardContent>
    </>
  );
}

function StepDone({
  selectedCount,
  onFinish,
  loading,
}: {
  selectedCount: number;
  onFinish: () => void;
  loading: boolean;
}) {
  const { t } = useTranslations();

  return (
    <>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <CardTitle className="text-2xl">{t("onboarding.doneTitle")}</CardTitle>
        <CardDescription>{t("onboarding.doneDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-center text-sm">
          {t("onboarding.doneCreatedLists", { count: String(selectedCount) })}
        </p>
        <Button onClick={onFinish} className="w-full" disabled={loading}>
          {loading ? t("common.loading") : t("onboarding.doneStart")}
        </Button>
      </CardContent>
    </>
  );
}
