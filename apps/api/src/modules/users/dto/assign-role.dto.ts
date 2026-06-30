import { IsOptional, IsString } from 'class-validator';

export class AssignRoleDto {
  /**
   * Aceita:
   * - UUID do papel (novo formato recomendado)
   * - `name` do papel (ex.: "admin", "gestor", "colaborador", "convidado")
   *   para compatibilidade com o seed inicial que usou `name` como id.
   * - `null` para remover o papel do vínculo (usuário sem role efetiva).
   */
  @IsOptional()
  @IsString()
  roleId?: string | null;
}