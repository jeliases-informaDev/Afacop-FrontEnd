import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import './alerts.css';

const DEFAULT_CONFIRM_BUTTON_COLOR = '#0b22a1';
const DEFAULT_CONFIRM_BUTTON_TEXT = 'Entendido';

const formatCount = value => Number(value ?? 0).toLocaleString('es-PE');

export class AppAlert {
  static fire(options = {}) {
    const { customClass, ...swalOptions } = options;
    const customClasses = typeof customClass === 'object' && customClass !== null ? customClass : {};

    return Swal.fire({
      confirmButtonColor: DEFAULT_CONFIRM_BUTTON_COLOR,
      confirmButtonText: DEFAULT_CONFIRM_BUTTON_TEXT,
      buttonsStyling: false,
      showClass: {
        popup: 'swal2-show app-swal-show'
      },
      hideClass: {
        popup: 'swal2-hide app-swal-hide'
      },
      ...swalOptions,
      customClass: {
        ...customClasses,
        container: ['app-swal-container', customClasses.container].filter(Boolean).join(' '),
        popup: ['app-swal-popup', customClasses.popup].filter(Boolean).join(' '),
        icon: ['app-swal-icon', customClasses.icon].filter(Boolean).join(' '),
        title: ['app-swal-title', customClasses.title].filter(Boolean).join(' '),
        htmlContainer: ['app-swal-content', customClasses.htmlContainer].filter(Boolean).join(' '),
        actions: ['app-swal-actions', customClasses.actions].filter(Boolean).join(' '),
        confirmButton: ['app-swal-confirm', customClasses.confirmButton].filter(Boolean).join(' ')
      }
    });
  }

  static success(title, text) {
    return this.fire({
      icon: 'success',
      title,
      text,
      confirmButtonText: 'Continuar'
    });
  }

  static error(title, text) {
    return this.fire({
      icon: 'error',
      title,
      text,
      confirmButtonText: 'Cerrar'
    });
  }

  static warning(title, text) {
    return this.fire({
      icon: 'warning',
      title,
      text,
      confirmButtonText: 'Revisar archivo'
    });
  }

  static importSummary({
    title = 'Importacion completada',
    insertadas = 0,
    actualizadas = 0,
    omitidas = 0,
    errores = 0
  }) {
    return this.fire({
      icon: 'success',
      title,
      confirmButtonText: 'Ver clientes',
      html: `
        <div class="app-swal-summary">
          <p><b>${formatCount(insertadas)}</b><span>nuevos</span></p>
          <p><b>${formatCount(actualizadas)}</b><span>actualizados</span></p>
          <p><b>${formatCount(omitidas)}</b><span>duplicados internos</span></p>
          <p><b>${formatCount(errores)}</b><span>errores</span></p>
        </div>
      `
    });
  }
}
