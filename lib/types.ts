export enum EstadoUsuario {
  PENDIENTE = 'pendiente',
  CONFIRMADO = 'confirmado',
  RECHAZADO = 'rechazado',
  ERROR = 'error',
}

export enum AlergiaAlimentaria {
  NINGUNA = 'ninguna',
  VEGANA = 'vegana',
  CELIACA = 'celiaca',
  SIN_LACTOSA = 'sin lactosa',
}

export interface UpdateRsvpDto {
  telefono: string;
  mail?: string;
  estado: EstadoUsuario;
  alergiaAlimentaria?: AlergiaAlimentaria;
  otrasAlergias?: string;
  mensaje?: string;
}
