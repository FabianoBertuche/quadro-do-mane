import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * Dispara o carregamento de dados:
 *  - no mount, de forma garantida (alguns devices/OS não emitem o evento de
 *    foco no primeiro render, deixando a tela presa no loading);
 *  - e em cada novo foco da tela (retorno à aba/stack).
 *
 * Não duplica a chamada quando mount e foco coincidem.
 */
export function useLoadOnMountAndFocus(load: () => void | Promise<void>) {
  const loadRef = useRef(load);
  const firstFocusRef = useRef(true);

  // Mantém o callback mais recente sem forçar re-render.
  useEffect(() => {
    loadRef.current = load;
  });

  // Garante o load no mount, independente do evento de foco.
  useEffect(() => {
    void loadRef.current();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (firstFocusRef.current) {
        firstFocusRef.current = false;
        return;
      }
      void loadRef.current();
    }, []),
  );
}