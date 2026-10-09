import { AppException } from "../dtos/appException.ts";

export class EntidadYaExistenteException extends AppException {
  constructor(numero: string) {
    super(`El pedido número ${numero} ya está en uso activo.`, 400);
  }
}