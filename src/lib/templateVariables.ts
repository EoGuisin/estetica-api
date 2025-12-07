export const TEMPLATE_VARIABLES = {
  // Patient variables
  "paciente.nome": "Nome completo do paciente",
  "paciente.cpf": "CPF do paciente",
  "paciente.rg": "RG do paciente",
  "paciente.dataNascimento": "Data de nascimento do paciente",
  "paciente.idade": "Idade do paciente",
  "paciente.genero": "Gênero do paciente",
  "paciente.nomeSocial": "Nome social do paciente",
  "paciente.nomeMae": "Nome da mãe do paciente",
  "paciente.ocupacao": "Ocupação do paciente",
  "paciente.telefone": "Telefone principal do paciente",

  // Patient address
  "paciente.endereco.cep": "CEP",
  "paciente.endereco.estado": "Estado",
  "paciente.endereco.cidade": "Cidade",
  "paciente.endereco.bairro": "Bairro",
  "paciente.endereco.rua": "Rua",
  "paciente.endereco.numero": "Número",
  "paciente.endereco.complemento": "Complemento",
  "paciente.endereco.completo": "Endereço completo formatado",

  // Clinic variables
  "clinica.nome": "Nome da clínica",
  "clinica.cnpj": "CNPJ da clínica",
  "clinica.endereco.completo": "Endereço completo da clínica",

  // Treatment plan variables
  "plano.especialidade": "Nome da especialidade",
  "plano.procedimento": "Nome do procedimento",
  "plano.sessoes": "Número de sessões contratadas",
  "plano.valorTotal": "Valor total do tratamento",

  // Date variables
  "data.hoje": "Data de hoje",
  "data.hojeExtenso": "Data de hoje por extenso",

  "assinaturas.profissional":
    "Imagem da assinatura do profissional (configurada no perfil)",
  "assinaturas.paciente":
    "Espaço para assinatura do paciente (preenchido ao assinar)",
};

export function substituteVariables(
  template: string,
  data: {
    patient: any;
    clinic: any;
    treatmentPlan?: any;
    professionalSignatureUrl?: string | null;
    patientSignatureUrl?: string | null;
  }
): string {
  let result = template;

  // Patient data
  result = result.replace(/{{paciente\.nome}}/g, data.patient.name || "");
  result = result.replace(
    /{{paciente\.cpf}}/g,
    formatCPF(data.patient.cpf) || ""
  );
  result = result.replace(/{{paciente\.rg}}/g, data.patient.identityCard || "");
  result = result.replace(
    /{{paciente\.dataNascimento}}/g,
    formatDate(data.patient.birthDate) || ""
  );
  result = result.replace(
    /{{paciente\.idade}}/g,
    calculateAge(data.patient.birthDate).toString()
  );
  result = result.replace(/{{paciente\.genero}}/g, data.patient.gender || "");
  result = result.replace(
    /{{paciente\.nomeSocial}}/g,
    data.patient.socialName || ""
  );
  result = result.replace(
    /{{paciente\.nomeMae}}/g,
    data.patient.motherName || ""
  );
  result = result.replace(
    /{{paciente\.ocupacao}}/g,
    data.patient.occupation || ""
  );

  // Patient address
  if (data.patient.address) {
    result = result.replace(
      /{{paciente\.endereco\.cep}}/g,
      data.patient.address.zipCode || ""
    );
    result = result.replace(
      /{{paciente\.endereco\.estado}}/g,
      data.patient.address.state || ""
    );
    result = result.replace(
      /{{paciente\.endereco\.cidade}}/g,
      data.patient.address.city || ""
    );
    result = result.replace(
      /{{paciente\.endereco\.bairro}}/g,
      data.patient.address.neighborhood || ""
    );
    result = result.replace(
      /{{paciente\.endereco\.rua}}/g,
      data.patient.address.street || ""
    );
    result = result.replace(
      /{{paciente\.endereco\.numero}}/g,
      data.patient.address.number || ""
    );
    result = result.replace(
      /{{paciente\.endereco\.complemento}}/g,
      data.patient.address.complement || ""
    );
    result = result.replace(
      /{{paciente\.endereco\.completo}}/g,
      formatAddress(data.patient.address)
    );
  }

  // Clinic data
  result = result.replace(/{{clinica\.nome}}/g, data.clinic.name || "");
  result = result.replace(
    /{{clinica\.cnpj}}/g,
    formatCNPJ(data.clinic.taxId) || ""
  );
  if (data.clinic.address) {
    result = result.replace(
      /{{clinica\.endereco\.completo}}/g,
      formatAddress(data.clinic.address)
    );
  }

  // Treatment plan data
  if (data.treatmentPlan) {
    result = result.replace(
      /{{plano\.especialidade}}/g,
      data.treatmentPlan.specialty || ""
    );
    result = result.replace(
      /{{plano\.procedimento}}/g,
      data.treatmentPlan.procedure || ""
    );
    result = result.replace(
      /{{plano\.sessoes}}/g,
      data.treatmentPlan.sessions?.toString() || ""
    );
    result = result.replace(
      /{{plano\.valorTotal}}/g,
      formatCurrency(data.treatmentPlan.total) || ""
    );
  }

  // Date variables
  const today = new Date();
  result = result.replace(/{{data\.hoje}}/g, formatDate(today));
  result = result.replace(/{{data\.hojeExtenso}}/g, formatDateExtensive(today));

  if (data.professionalSignatureUrl) {
    // Insere a imagem. Ajuste o max-height conforme necessário.
    const imgTag = `<div style="display:inline-block; text-align:center;">
        <img src="${data.professionalSignatureUrl}" style="max-height: 80px; max-width: 250px; object-fit: contain;" /><br/>
        <span style="font-size: 10px;">Assinado digitalmente pelo profissional</span>
    </div>`;
    result = result.replace(/{{assinaturas\.profissional}}/g, imgTag);
  } else {
    // Se não tiver assinatura, coloca linha
    result = result.replace(
      /{{assinaturas\.profissional}}/g,
      `<div style="margin-top: 30px; border-top: 1px solid #000; width: 250px; text-align: center;">Assinatura do Profissional</div>`
    );
  }

  // 2. Assinatura do Paciente
  if (data.patientSignatureUrl) {
    const imgTag = `<div style="display:inline-block; text-align:center;">
        <img src="${
          data.patientSignatureUrl
        }" style="max-height: 80px; max-width: 250px; object-fit: contain;" /><br/>
        <span style="font-size: 10px;">Assinado digitalmente pelo paciente em ${new Date().toLocaleDateString(
          "pt-BR"
        )}</span>
    </div>`;
    result = result.replace(/{{assinaturas\.paciente}}/g, imgTag);
  } else {
    // Linha para assinar depois se imprimir
    result = result.replace(
      /{{assinaturas\.paciente}}/g,
      `<div style="margin-top: 30px; border-top: 1px solid #000; width: 250px; text-align: center;">Assinatura do Paciente</div>`
    );
  }

  return result;
}

function formatCPF(cpf: string): string {
  if (!cpf) return "";
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatCNPJ(cnpj: string): string {
  if (!cnpj) return "";
  return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("pt-BR");
}

function formatDateExtensive(date: Date): string {
  const months = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  const d = new Date(date);
  return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
}

function calculateAge(birthDate: Date | string): number {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function formatAddress(address: any): string {
  const parts = [
    address.street,
    address.number,
    address.complement,
    address.neighborhood,
    address.city,
    address.state,
    address.zipCode,
  ].filter(Boolean);
  return parts.join(", ");
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}
