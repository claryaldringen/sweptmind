export interface List {
  id: string;
  userId: string;
  groupId: string | null;
  locationId: string | null;
  deviceContext: string | null;
  name: string;
  icon: string | null;
  themeColor: string | null;
  isDefault: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListGroup {
  id: string;
  userId: string;
  name: string;
  sortOrder: number;
  isExpanded: boolean;
  createdAt: Date;
}

export interface CreateListInput {
  id?: string | null;
  name: string;
  icon?: string | null;
  themeColor?: string | null;
  groupId?: string | null;
}

export interface UpdateListInput {
  name?: string | null;
  icon?: string | null;
  themeColor?: string | null;
  groupId?: string | null;
  locationId?: string | null;
  deviceContext?: string | null;
}

export interface ReorderItem {
  id: string;
  sortOrder: number;
}
