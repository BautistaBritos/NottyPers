import { AppException } from "../dtos/appException.ts";

export class EntidadNoEncontradaException extends AppException {
  constructor(entidad: string) {
    super(`no se encontró el pedido ${entidad}`, 404);
  }
}