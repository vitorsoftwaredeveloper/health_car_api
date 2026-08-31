import mongoose from "mongoose";
import { accountRepository } from "../../src/repositories/account.repository";
import { alertRepository } from "../../src/repositories/alert.repository";
import { attachmentRepository } from "../../src/repositories/attachment.repository";
import { catalogItemRepository } from "../../src/repositories/catalogItem.repository";
import { diagnosticChecklistRepository } from "../../src/repositories/diagnosticChecklist.repository";
import { diagnosticCodeRepository } from "../../src/repositories/diagnosticCode.repository";
import { diagnosticSessionRepository } from "../../src/repositories/diagnosticSession.repository";
import { maintenanceEventRepository } from "../../src/repositories/maintenanceEvent.repository";
import { notificationRepository } from "../../src/repositories/notification.repository";
import { odometerReadingRepository } from "../../src/repositories/odometerReading.repository";
import { planItemRepository } from "../../src/repositories/planItem.repository";
import { planTemplateRepository } from "../../src/repositories/planTemplate.repository";
import { pushDeviceRepository } from "../../src/repositories/pushDevice.repository";
import { userRepository } from "../../src/repositories/user.repository";
import { vehicleRepository } from "../../src/repositories/vehicle.repository";

const LOCAL_CONNECTION = "mongodb://localhost:27017/health_car?replicaSet=rs0";

const repositories = [
  accountRepository,
  alertRepository,
  attachmentRepository,
  catalogItemRepository,
  diagnosticChecklistRepository,
  diagnosticCodeRepository,
  diagnosticSessionRepository,
  maintenanceEventRepository,
  notificationRepository,
  odometerReadingRepository,
  planItemRepository,
  planTemplateRepository,
  pushDeviceRepository,
  userRepository,
  vehicleRepository,
];

const run = async (): Promise<void> => {
  await mongoose.connect(process.env.DB || LOCAL_CONNECTION);

  for (const repository of repositories) {
    await repository.model.syncIndexes();
    console.log(`índices sincronizados: ${repository.model.modelName}`);
  }

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
