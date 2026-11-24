// =====================================================================
// OSK Zdzich – LP demonstracyjna
// Zakres: animacje, nawigacja, walidacja formularza (symulacja),
// sygnały do lokalnej tablicy dataLayer (wejście dla GTM).
// Brak żądań sieciowych i brak przekazywania danych z pól do URL.
// =====================================================================

// Lokalna warstwa danych. Sama tablica niczego nie wysyła do Google ani Meta.
window.dataLayer = window.dataLayer || [];

// Jedno miejsce wysyłania sygnałów. W parametrach nigdy nie ma wartości pól.
function pushEvent(eventName, params) {
    window.dataLayer.push(Object.assign({ event: eventName }, params || {}));
}

// Klasa "js" włącza animacje, które bez skryptu zostałyby ukryte
document.documentElement.classList.add('js');

document.addEventListener('DOMContentLoaded', () => {

    // ------------------------------------------------------------
    // 1. Logo: powrót na górę
    // ------------------------------------------------------------
    const logoContainer = document.getElementById('logoContainer');
    if (logoContainer) {
        logoContainer.addEventListener('click', (e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // ------------------------------------------------------------
    // 2. Animacja pojawiania się tekstów (przy przewijaniu w obu kierunkach)
    // ------------------------------------------------------------
    const texts = document.querySelectorAll('.gta-text');
    if ('IntersectionObserver' in window) {
        const textObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                entry.target.classList.toggle('visible', entry.isIntersecting);
            });
        }, { rootMargin: '0px 0px -100px 0px' });
        texts.forEach((t) => textObserver.observe(t));
    } else {
        texts.forEach((t) => t.classList.add('visible'));
    }

    // ------------------------------------------------------------
    // 3. Sygnał section_view dla sekcji oferty (raz na wyświetlenie strony)
    // ------------------------------------------------------------
    const offerSection = document.getElementById('oferta');
    if (offerSection && 'IntersectionObserver' in window) {
        const offerObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    pushEvent('section_view', { section_id: 'oferta' });
                    offerObserver.disconnect();
                }
            });
        }, { threshold: 0.3 });
        offerObserver.observe(offerSection);
    }

    // ------------------------------------------------------------
    // 4. CTA: przewinięcie do formularza + sygnał cta_click
    //    Sygnał tylko przy prawdziwym kliknięciu użytkownika (isTrusted).
    // ------------------------------------------------------------
    const form = document.getElementById('lead-form');
    const firstField = document.getElementById('fullName');

    document.querySelectorAll('[data-cta-location]').forEach((cta) => {
        cta.addEventListener('click', (e) => {
            e.preventDefault();
            if (e.isTrusted) {
                pushEvent('cta_click', { cta_location: cta.dataset.ctaLocation });
            }
            if (form) {
                form.scrollIntoView({ behavior: 'smooth', block: 'center' });
                if (firstField) {
                    setTimeout(() => firstField.focus({ preventScroll: true }), 500);
                }
            }
        });
    });

    // ------------------------------------------------------------
    // 5. Formularz demonstracyjny
    // ------------------------------------------------------------
    if (!form) return;

    const submitBtn = document.getElementById('submit-btn');
    const errorSummary = document.getElementById('form-error-summary');
    const successBox = document.getElementById('form-success');

    let formStarted = false;   // form_start najwyżej raz na wyświetlenie strony
    let leadSent = false;      // lead_success najwyżej raz na wyświetlenie strony

    // form_start: pierwsza zmiana wartości dowolnego pola
    function onFirstChange() {
        if (formStarted) return;
        formStarted = true;
        pushEvent('form_start', { form_id: form.id });
    }
    form.addEventListener('input', onFirstChange);
    form.addEventListener('change', onFirstChange);

    // --- Walidacja ------------------------------------------------
    // Zwraca obiekt błędów: { idPola: 'komunikat' }. Pusty = dane poprawne.
    function validate() {
        const errors = {};

        const name = form.elements.fullName.value.trim();
        if (name.length < 2 || !/\p{L}/u.test(name)) {
            errors.fullName = 'Podaj imię (minimum 2 znaki).';
        }

        // Telefon: opcjonalny prefiks +48 / 0048, potem 9 cyfr; spacje i myślniki dozwolone
        const phone = form.elements.phone.value.replace(/[\s-]/g, '');
        if (!/^(\+48|0048)?[1-9]\d{8}$/.test(phone)) {
            errors.phone = 'Podaj numer w formacie 123 456 789 lub +48 123 456 789.';
        }

        if (!form.elements.variant.value) {
            errors.variant = 'Wybierz wariant kursu.';
        }

        if (!form.querySelector('input[name="category"]:checked')) {
            errors.category = 'Wybierz kategorię A lub B.';
        }

        if (!form.elements.consent.checked) {
            errors.consent = 'Zaznacz zgodę na kontakt, aby wysłać zgłoszenie.';
        }

        return errors;
    }

    // Pola, do których przypisujemy komunikaty
    const fieldMap = {
        fullName: () => form.elements.fullName,
        phone: () => form.elements.phone,
        variant: () => form.elements.variant,
        category: () => form.querySelector('input[name="category"]'),
        consent: () => form.elements.consent
    };

    function showErrors(errors) {
        Object.keys(fieldMap).forEach((key) => {
            const msgEl = document.getElementById('err-' + key);
            const field = fieldMap[key]();
            const message = errors[key] || '';
            msgEl.textContent = message;
            if (key === 'category') {
                form.querySelectorAll('input[name="category"]').forEach((r) => {
                    r.setAttribute('aria-invalid', message ? 'true' : 'false');
                });
            } else {
                field.setAttribute('aria-invalid', message ? 'true' : 'false');
            }
        });

        const keys = Object.keys(errors);
        if (keys.length) {
            errorSummary.textContent = 'Formularz zawiera błędy. Popraw zaznaczone pola i spróbuj ponownie.';
            errorSummary.hidden = false;
            fieldMap[keys[0]]().focus();
        } else {
            errorSummary.hidden = true;
            errorSummary.textContent = '';
        }
    }

    // Walidacja po wysłaniu. To jedyne miejsce, w którym decydujemy o sukcesie.
    form.addEventListener('submit', (e) => {
        // Zawsze blokujemy domyślne wysłanie: brak żądania i brak danych w adresie URL
        e.preventDefault();

        // Po sukcesie kolejne wysłania są ignorowane (przycisk jest też zablokowany)
        if (leadSent) return;

        const errors = validate();
        showErrors(errors);

        if (Object.keys(errors).length > 0) {
            successBox.hidden = true;
            return; // błąd: brak komunikatu sukcesu i brak lead_success
        }

        // --- Potwierdzony demonstracyjny sukces -------------------
        leadSent = true;
        submitBtn.disabled = true;
        successBox.textContent = 'Demonstracja zakończona — dane nie zostały wysłane';
        successBox.hidden = false;

        // Sygnał lead_success: tylko tutaj, najwyżej raz, bez wartości pól
        pushEvent('lead_success', { form_id: form.id });
    });

    // Poprawianie błędów na bieżąco: znika komunikat przy zmianie pola
    form.addEventListener('input', (e) => {
        const target = e.target;
        if (target.getAttribute && target.getAttribute('aria-invalid') === 'true') {
            const key = target.name === 'category' ? 'category' : target.id;
            const msgEl = document.getElementById('err-' + key);
            if (msgEl) msgEl.textContent = '';
            if (key === 'category') {
                form.querySelectorAll('input[name="category"]').forEach((r) => r.setAttribute('aria-invalid', 'false'));
            } else {
                target.setAttribute('aria-invalid', 'false');
            }
        }
    });

    // ------------------------------------------------------------
    // 6. Zmiana zgód (miejsce na CMP, np. Cookiebot na spotkaniu 3)
    // ------------------------------------------------------------
    const consentBtn = document.getElementById('zmien-zgody');
    const consentStatus = document.getElementById('consent-status');
    if (consentBtn) {
        consentBtn.addEventListener('click', () => {
            if (window.Cookiebot && typeof window.Cookiebot.renew === 'function') {
                window.Cookiebot.renew();
            } else if (consentStatus) {
                consentStatus.textContent = 'Mechanizm wyboru zgód (CMP) nie jest jeszcze podłączony. Zostanie dodany w kolejnym etapie projektu.';
            }
        });
    }
});
