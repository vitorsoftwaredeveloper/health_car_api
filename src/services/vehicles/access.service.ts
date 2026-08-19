import { Types } from "mongoose";
import { vehicleRepository } from "../../repositories/vehicle.repository";
import { AccessLevel } from "../../types/auth";
import { Requester } from "../../types/user";
import { VehicleDocument } from "../../types/vehicle";
import { httpError, STATUS_CODE } from "../../utils/errors";

const notFound = () =>
  httpError(
    STATUS_CODE.NOT_FOUND,
    "VEHICLE_NOT_FOUND",
    "Veículo não encontrado.",
  );

const toObjectId = (vehicleId: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(vehicleId)) throw notFound();
  return new Types.ObjectId(vehicleId);
};

const isDriver = (vehicle: VehicleDocument, requester: Requester): boolean =>
  vehicle.drivers.some(
    (driver) => String(driver.userId) === String(requester.userId),
  );

const belongsToAccount = (
  vehicle: VehicleDocument,
  requester: Requester,
): boolean => String(vehicle.accountId) === String(requester.accountId);

export const assertVehicleAccess = async (
  requester: Requester,
  vehicleId: string,
  level: AccessLevel,
): Promise<VehicleDocument> => {
  const vehicle = (await vehicleRepository.findOne({
    _id: toObjectId(vehicleId),
  })) as VehicleDocument | null;

  if (!vehicle) throw notFound();

  const allowed =
    requester.role === "driver"
      ? isDriver(vehicle, requester)
      : belongsToAccount(vehicle, requester) || isDriver(vehicle, requester);

  if (!allowed) throw notFound();

  if (level === "manage" && requester.role !== "owner") {
    throw httpError(
      STATUS_CODE.FORBIDDEN,
      "FORBIDDEN",
      "Só o proprietário pode alterar este veículo.",
    );
  }

  if (level === "manage" && !belongsToAccount(vehicle, requester)) {
    throw notFound();
  }

  return vehicle;
};
