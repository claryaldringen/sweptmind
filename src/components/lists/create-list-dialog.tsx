"use client";

import { useState } from "react";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";
import { LIST_ICONS } from "@/lib/list-icons";
import { cn } from "@/lib/utils";

const CREATE_LIST = gql`
  mutation CreateList($input: CreateListInput!) {
    createList(input: $input) {
      id
      name
      icon
      themeColor
      isDefault
      sortOrder
      groupId
      locationId
      deviceContext
      location {
        id
        name
        latitude
        longitude
        radius
      }
    }
  }
`;

interface CreateListData {
  createList: {
    id: string;
    name: string;
    icon: string | null;
    themeColor: string | null;
    isDefault: boolean;
    sortOrder: number;
    groupId: string | null;
    locationId: string | null;
    deviceContext: string | null;
    location: {
      id: string;
      name: string;
      latitude: number;
      longitude: number;
      radius: number;
    } | null;
  };
}

interface CreateListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateListDialog({ open, onOpenChange }: CreateListDialogProps) {
  const [name, setName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState<string>("list");
  const { t } = useTranslations();
  const router = useRouter();
  const [createList, { loading }] = useMutation<CreateListData>(CREATE_LIST, {
    update(cache, { data }) {
      if (!data?.createList) return;
      cache.modify({
        fields: {
          lists(existing = []) {
            const newRef = cache.writeFragment({
              data: data.createList,
              fragment: gql`
                fragment NewList on List {
                  id
                  name
                  icon
                  themeColor
                  isDefault
                  sortOrder
                  groupId
                  locationId
                  deviceContext
                  location {
                    id
                    name
                    latitude
                    longitude
                    radius
                  }
                }
              `,
            });
            return [...existing, newRef];
          },
        },
      });
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const result = await createList({
      variables: { input: { name: name.trim(), icon: selectedIcon } },
    });

    setName("");
    setSelectedIcon("list");
    onOpenChange(false);
    if (result.data?.createList?.id) {
      router.push(`/lists/${result.data.createList.id}`);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setName("");
          setSelectedIcon("list");
        }
        onOpenChange(isOpen);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("lists.newList")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder={t("lists.listName")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <div className="grid grid-cols-8 gap-1.5">
            {Object.entries(LIST_ICONS).map(([key, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedIcon(key)}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
                  selectedIcon === key
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4.5 w-4.5" />
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("lists.cancel")}
            </Button>
            <Button type="submit" disabled={!name.trim() || loading}>
              {t("lists.create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
