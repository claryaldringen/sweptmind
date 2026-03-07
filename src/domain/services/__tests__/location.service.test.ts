import { describe, it, expect, vi, beforeEach } from "vitest";
import { LocationService } from "../location.service";
import type { ILocationRepository } from "../../repositories/location.repository";
import type { Location } from "../../entities/location";

function makeLocation(overrides: Partial<Location> = {}): Location {
  return {
    id: "loc-1",
    userId: "user-1",
    name: "Beroun",
    latitude: 49.9637,
    longitude: 14.0722,
    address: "Beroun, Czech Republic",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

function makeRepo(overrides: Partial<ILocationRepository> = {}): ILocationRepository {
  return {
    findByUser: vi.fn().mockResolvedValue([]),
    findById: vi.fn(),
    findByIds: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    ...overrides,
  };
}

describe("LocationService", () => {
  let repo: ILocationRepository;
  let service: LocationService;

  beforeEach(() => {
    repo = makeRepo();
    service = new LocationService(repo);
  });

  describe("getByUser", () => {
    it("deleguje na repo", async () => {
      await service.getByUser("user-1");
      expect(repo.findByUser).toHaveBeenCalledWith("user-1");
    });
  });

  describe("create", () => {
    it("vytvoří lokaci s adresou", async () => {
      vi.mocked(repo.create).mockResolvedValue(makeLocation());

      await service.create("user-1", {
        name: "Beroun",
        latitude: 49.9637,
        longitude: 14.0722,
        address: "Beroun, CZ",
      });

      expect(repo.create).toHaveBeenCalledWith({
        userId: "user-1",
        name: "Beroun",
        latitude: 49.9637,
        longitude: 14.0722,
        address: "Beroun, CZ",
      });
    });

    it("vytvoří lokaci bez adresy", async () => {
      vi.mocked(repo.create).mockResolvedValue(makeLocation({ address: null }));

      await service.create("user-1", {
        name: "Test",
        latitude: 50.0,
        longitude: 14.0,
      });

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ address: null }));
    });
  });

  describe("update", () => {
    it("aktualizuje jen poskytnuté fieldy", async () => {
      vi.mocked(repo.update).mockResolvedValue(makeLocation({ name: "Updated" }));

      await service.update("loc-1", "user-1", { name: "Updated" });

      expect(repo.update).toHaveBeenCalledWith("loc-1", "user-1", { name: "Updated" });
    });
  });

  describe("delete", () => {
    it("deleguje na repo a vrátí true", async () => {
      const result = await service.delete("loc-1", "user-1");

      expect(repo.delete).toHaveBeenCalledWith("loc-1", "user-1");
      expect(result).toBe(true);
    });
  });

  describe("getById", () => {
    it("deleguje na repo s id a userId", async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeLocation());

      const result = await service.getById("loc-1", "user-1");

      expect(repo.findById).toHaveBeenCalledWith("loc-1", "user-1");
      expect(result).toEqual(makeLocation());
    });

    it("vrátí undefined pokud lokace neexistuje", async () => {
      vi.mocked(repo.findById).mockResolvedValue(undefined);

      const result = await service.getById("non-existent", "user-1");

      expect(result).toBeUndefined();
    });
  });

  describe("create – edge cases", () => {
    it("předá address jako null když je undefined v inputu", async () => {
      vi.mocked(repo.create).mockResolvedValue(makeLocation({ address: null }));

      await service.create("user-1", {
        name: "No Address",
        latitude: 50.0,
        longitude: 14.0,
        address: undefined,
      });

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ address: null }));
    });

    it("předá explicitní null address", async () => {
      vi.mocked(repo.create).mockResolvedValue(makeLocation({ address: null }));

      await service.create("user-1", {
        name: "Null Address",
        latitude: 50.0,
        longitude: 14.0,
        address: null,
      });

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ address: null }));
    });
  });

  describe("update – edge cases", () => {
    it("aktualizuje všechny fieldy najednou", async () => {
      vi.mocked(repo.update).mockResolvedValue(
        makeLocation({ name: "New", latitude: 51.0, longitude: 15.0, address: "New addr" }),
      );

      await service.update("loc-1", "user-1", {
        name: "New",
        latitude: 51.0,
        longitude: 15.0,
        address: "New addr",
      });

      expect(repo.update).toHaveBeenCalledWith("loc-1", "user-1", {
        name: "New",
        latitude: 51.0,
        longitude: 15.0,
        address: "New addr",
      });
    });

    it("nastaví address na null při explicitním null v inputu", async () => {
      vi.mocked(repo.update).mockResolvedValue(makeLocation({ address: null }));

      await service.update("loc-1", "user-1", { address: null });

      expect(repo.update).toHaveBeenCalledWith("loc-1", "user-1", { address: null });
    });

    it("nepředá address pokud není v inputu", async () => {
      vi.mocked(repo.update).mockResolvedValue(makeLocation({ name: "Only name" }));

      await service.update("loc-1", "user-1", { name: "Only name" });

      expect(repo.update).toHaveBeenCalledWith("loc-1", "user-1", { name: "Only name" });
    });
  });
});
