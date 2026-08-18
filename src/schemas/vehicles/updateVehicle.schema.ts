import { JSONSchemaType } from "ajv";
import { UpdateVehiclePayload } from "../../services/vehicles/vehicle.service";

const FUELS = ["flex", "gasoline", "ethanol", "diesel", "cng", "hybrid", "electric"];
const TRANSMISSIONS = ["manual", "automatic", "cvt", "automated"];
const STATUSES = ["active", "sold", "archived"];

export const updateVehicleSchema: JSONSchemaType<UpdateVehiclePayload> = {
  type: "object",
  additionalProperties: false,
  properties: {
    nickname: { type: "string", minLength: 1, maxLength: 60 },
    make: { type: "string", minLength: 1, maxLength: 40 },
    model: { type: "string", minLength: 1, maxLength: 60 },
    trim: { type: "string", maxLength: 40, nullable: true },
    manufactureYear: { type: "integer", minimum: 1950, maximum: 2100 },
    modelYear: { type: "integer", minimum: 1950, maximum: 2100 },
    engine: { type: "string", maxLength: 40, nullable: true },
    fuel: { type: "string", enum: FUELS as any },
    transmission: { type: "string", enum: TRANSMISSIONS as any, nullable: true },
    plate: { type: "string", minLength: 7, maxLength: 10 },
    vin: { type: "string", minLength: 17, maxLength: 17, nullable: true },
    color: { type: "string", maxLength: 30, nullable: true },
    status: { type: "string", enum: STATUSES as any, nullable: true },
  },
  required: [
    "nickname",
    "make",
    "model",
    "manufactureYear",
    "modelYear",
    "fuel",
    "plate",
  ],
};
