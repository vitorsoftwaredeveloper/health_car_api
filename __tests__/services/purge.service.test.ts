import { Types } from "mongoose";

jest.mock("../../src/repositories/attachment.repository", () => ({
  attachmentRepository: { find: jest.fn(), deleteMany: jest.fn() },
}));
jest.mock("../../src/repositories/maintenanceEvent.repository", () => ({
  maintenanceEventRepository: { deleteMany: jest.fn() },
}));
jest.mock("../../src/libs/s3", () => ({ deleteObject: jest.fn() }));

import { attachmentRepository } from "../../src/repositories/attachment.repository";
import { maintenanceEventRepository } from "../../src/repositories/maintenanceEvent.repository";
import { deleteObject } from "../../src/libs/s3";
import { runPurgeExpired } from "../../src/services/purge/purge.service";

const reference = new Date("2026-09-19T09:00:00.000Z");

const attachment = (key: string) => ({ _id: new Types.ObjectId(), s3Key: key });

beforeEach(() => {
  (attachmentRepository.find as jest.Mock).mockResolvedValue([]);
  (attachmentRepository.deleteMany as jest.Mock).mockResolvedValue({ deletedCount: 0 });
  (maintenanceEventRepository.deleteMany as jest.Mock).mockResolvedValue({ deletedCount: 0 });
});

describe("runPurgeExpired", () => {
  it("busca só o que passou da carência", async () => {
    await runPurgeExpired(reference);

    const filter = { purgeAfter: { $ne: null, $lte: reference } };
    expect((attachmentRepository.find as jest.Mock).mock.calls[0][0]).toEqual(filter);
    expect((maintenanceEventRepository.deleteMany as jest.Mock).mock.calls[0][0]).toEqual(filter);
  });

  it("apaga o objeto no S3 antes de apagar o registro", async () => {
    (attachmentRepository.find as jest.Mock).mockResolvedValue([
      attachment("accounts/a/1.pdf"),
      attachment("accounts/a/2.jpg"),
    ]);
    (attachmentRepository.deleteMany as jest.Mock).mockResolvedValue({ deletedCount: 2 });
    (maintenanceEventRepository.deleteMany as jest.Mock).mockResolvedValue({ deletedCount: 5 });

    const result = await runPurgeExpired(reference);

    expect(deleteObject).toHaveBeenCalledWith("accounts/a/1.pdf");
    expect(result).toEqual({
      eventsPurged: 5,
      attachmentsPurged: 2,
      objectsRemoved: 2,
      objectFailures: 0,
    });
  });

  it("mantém o registro do anexo cujo objeto não pôde ser apagado", async () => {
    (attachmentRepository.find as jest.Mock).mockResolvedValue([
      attachment("accounts/a/1.pdf"),
      attachment("accounts/a/2.jpg"),
    ]);
    (deleteObject as jest.Mock)
      .mockRejectedValueOnce(new Error("access denied"))
      .mockResolvedValueOnce(undefined);
    (attachmentRepository.deleteMany as jest.Mock).mockResolvedValue({ deletedCount: 2 });

    const result = await runPurgeExpired(reference);

    expect(result.objectFailures).toBe(1);
    expect(result.objectsRemoved).toBe(1);
    expect(
      (attachmentRepository.deleteMany as jest.Mock).mock.calls[0][0]._id.$in,
    ).toHaveLength(1);
  });

  it("não chama o banco de anexos quando não há nada vencido", async () => {
    await runPurgeExpired(reference);

    expect(attachmentRepository.deleteMany).not.toHaveBeenCalled();
    expect(deleteObject).not.toHaveBeenCalled();
  });
});
