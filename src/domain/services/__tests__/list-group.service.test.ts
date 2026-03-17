import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListGroupService } from "../list-group.service";
import type { IListGroupRepository } from "../../repositories/list-group.repository";
import type { IListRepository } from "../../repositories/list.repository";
import type { ListGroup } from "../../entities/list";

function makeGroup(overrides: Partial<ListGroup> = {}): ListGroup {
  return {
    id: "group-1",
    userId: "user-1",
    name: "Test group",
    sortOrder: 0,
    isExpanded: true,
    createdAt: new Date("2024-01-01"),
    ...overrides,
  };
}

function makeGroupRepo(overrides: Partial<IListGroupRepository> = {}): IListGroupRepository {
  return {
    findByUser: vi.fn().mockResolvedValue([]),
    findMaxSortOrder: vi.fn().mockResolvedValue(undefined),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    ...overrides,
  };
}

function makeListRepo(overrides: Partial<IListRepository> = {}): IListRepository {
  return {
    findDefault: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn(),
    findByIds: vi.fn().mockResolvedValue([]),
    findByUser: vi.fn().mockResolvedValue([]),
    findByGroup: vi.fn().mockResolvedValue([]),
    findMaxSortOrder: vi.fn().mockResolvedValue(undefined),
    create: vi.fn(),
    update: vi.fn(),
    deleteNonDefault: vi.fn(),
    updateSortOrder: vi.fn(),
    ungroupByGroupId: vi.fn(),
    deleteManyNonDefault: vi.fn(),
    ...overrides,
  };
}

describe("ListGroupService", () => {
  let groupRepo: IListGroupRepository;
  let listRepo: IListRepository;
  let service: ListGroupService;

  beforeEach(() => {
    groupRepo = makeGroupRepo();
    listRepo = makeListRepo();
    service = new ListGroupService(groupRepo, listRepo);
  });

  describe("create", () => {
    it("vypočítá sortOrder a vytvoří skupinu", async () => {
      vi.mocked(groupRepo.findMaxSortOrder).mockResolvedValue(1);
      vi.mocked(groupRepo.create).mockResolvedValue(makeGroup({ sortOrder: 2 }));

      await service.create("user-1", "New group");

      expect(groupRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "user-1", name: "New group", sortOrder: 2 }),
      );
    });
  });

  describe("update", () => {
    it("aktualizuje název skupiny", async () => {
      vi.mocked(groupRepo.update).mockResolvedValue(makeGroup({ name: "Renamed" }));

      await service.update("group-1", "user-1", "Renamed");

      expect(groupRepo.update).toHaveBeenCalledWith("group-1", "user-1", { name: "Renamed" });
    });
  });

  describe("delete", () => {
    it("nejdřív odebere groupId z listů a pak smaže skupinu", async () => {
      const result = await service.delete("group-1", "user-1");

      expect(listRepo.ungroupByGroupId).toHaveBeenCalledWith("group-1");
      expect(groupRepo.delete).toHaveBeenCalledWith("group-1", "user-1");
      expect(result).toBe(true);
    });

    it("volá ungroup PŘED delete", async () => {
      const callOrder: string[] = [];
      vi.mocked(listRepo.ungroupByGroupId).mockImplementation(async () => {
        callOrder.push("ungroup");
      });
      vi.mocked(groupRepo.delete).mockImplementation(async () => {
        callOrder.push("delete");
      });

      await service.delete("group-1", "user-1");

      expect(callOrder).toEqual(["ungroup", "delete"]);
    });
  });
});
