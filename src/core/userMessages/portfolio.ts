export const portfolioMessages = {
    ASSET_NOT_FOUND: 'Activo no encontrado',
    TRANSACTION_NOT_FOUND: 'Operación no encontrada',
    TRANSACTION_DELETED: 'Operación eliminada',
    symbolExists: (symbol: string) => `El símbolo ${symbol} ya existe`,
    SYMBOL_QUERY_TOO_SHORT: 'Escribe al menos 2 caracteres para buscar',
    SYMBOL_QUERY_TOO_LONG: 'La búsqueda admite máximo 20 caracteres',
    SYMBOL_SEARCH_UNAVAILABLE: 'La búsqueda de símbolos no está disponible, captura el activo manualmente',
};
