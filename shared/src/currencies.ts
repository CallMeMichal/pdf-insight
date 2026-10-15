/**
 * Kody walut ISO 4217 (lista 1: waluty i fundusze w obiegu, łącznie z metalami szlachetnymi),
 * bez kodów testowych `XTS` i „brak waluty” `XXX`. Zapisane na stałe, a nie brane
 * z `Intl.supportedValuesOf`, bo lista ICU różni się między przeglądarkami a Workerem
 * i starsze przeglądarki jej nie mają — Worker i strona muszą walidować identycznie.
 */
export const ISO_4217_CODES: ReadonlySet<string> = new Set(
  (
    'AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BOV BRL BSD ' +
    'BTN BWP BYN BZD CAD CDF CHE CHF CHW CLF CLP CNY COP COU CRC CUP CVE CZK DJF DKK DOP DZD ' +
    'EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD ' +
    'IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL ' +
    'MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MXV MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN ' +
    'PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SLL SOS SRD SSP ' +
    'STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD USN UYI UYU UYW UZS VED ' +
    'VES VND VUV WST XAF XAG XAU XBA XBB XBC XBD XCD XCG XDR XOF XPD XPF XPT XSU XUA YER ZAR ' +
    'ZMW ZWG ZWL'
  ).split(' '),
);
