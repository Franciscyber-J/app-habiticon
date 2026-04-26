import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Registo de fontes para garantir compatibilidade e aspeto profissional
Font.register({
  family: 'Open Sans',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/npm/open-sans-all@0.1.3/fonts/open-sans-regular.ttf' },
    { src: 'https://cdn.jsdelivr.net/npm/open-sans-all@0.1.3/fonts/open-sans-700.ttf', fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: { padding: '40px 50px', fontSize: 10, fontFamily: 'Open Sans', lineHeight: 1.5, color: '#111' },
  header: { marginBottom: 20, textAlign: 'center' },
  title: { fontSize: 12, fontWeight: 700, textAlign: 'center', textTransform: 'uppercase' },
  subtitle: { fontSize: 10, fontWeight: 700, textAlign: 'center', marginBottom: 20, textTransform: 'uppercase' },
  sectionTitle: { fontSize: 10, fontWeight: 700, marginTop: 15, marginBottom: 8, textTransform: 'uppercase' },
  paragraph: { textAlign: 'justify', marginBottom: 8, textIndent: 20 },
  paragraphNoIndent: { textAlign: 'justify', marginBottom: 8 },
  bold: { fontWeight: 700 },
  signatureArea: { marginTop: 50, flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 },
  signatureBox: { borderTopWidth: 1, borderTopColor: '#000', width: '45%', paddingTop: 5, textAlign: 'center', marginTop: 30 }
});

const formatBRL = (val: number) => 
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0);

export const ContratoPDF = ({ data }: { data: any }) => (
  <Document title={`Contrato - ${data.nome}`}>
    <Page size="A4" style={styles.page}>
      
      <View style={styles.header}>
        <Text style={styles.title}>INSTRUMENTO PARTICULAR DE CONTRATO DE EMPREITADA PARA CONSTRUÇÃO DE</Text>
        <Text style={styles.subtitle}>UNIDADE HABITACIONAL E OUTRAS AVENÇAS</Text>
      </View>

      <Text style={styles.paragraphNoIndent}>
        <Text style={styles.bold}>CONTRATANTE(S): </Text>
        <Text style={styles.bold}>{data.nome.toUpperCase()}</Text>, {data.nacionalidade || 'brasileiro(a)'}, {data.estadoCivil || '___'}, {data.profissao || '___'}, 
        portador(a) do RG nº {data.rg || '___'} e inscrito(a) no CPF sob o nº <Text style={styles.bold}>{data.cpf || '___'}</Text>, 
        residente e domiciliado(a) em {data.endereco || '___'}.
      </Text>

      <Text style={styles.paragraphNoIndent}>
        <Text style={styles.bold}>CONTRATADA: HABITICON CONSTRUÇÃO INTELIGENTE </Text> 
        (PROJETAR ENGENHARIA INTELIGENTE LTDA), pessoa jurídica de direito privado, inscrita no CNPJ sob o 
        nº 61.922.155/0001-70, com sede na AV T-9, nº 2310, Sala 203 B, Edifício Inteligent Place, 
        Bairro Jardim América, Goiânia-GO, CEP 74.255-220, neste ato representada por seu sócio 
        administrador, Sr. AGMÁRIO SEBASTIÃO DE FREITAS, brasileiro, divorciado, portador do 
        documento de identidade nº 3231203 SSP/GO, inscrito no CPF sob o nº 547.364.711-15, 
        doravante denominada CONSTRUTORA.
      </Text>

      <Text style={styles.paragraph}>
        As partes acima qualificadas, por este instrumento e na melhor forma de direito, 
        celebram o presente Contrato de Empreitada para Construção de Unidade Habitacional, em 
        caráter irrevogável e irretratável, que se regerá pelas seguintes cláusulas e condições:
      </Text>

      <Text style={styles.sectionTitle}>CLÁUSULA PRIMEIRA - DO OBJETO</Text>
      <Text style={styles.paragraph}>
        1.1. O objeto deste contrato é a prestação de serviços de construção civil, em 
        regime de empreitada, pela CONSTRUTORA em favor do(a) CONTRATANTE, para edificação 
        de uma unidade habitacional residencial com área de <Text style={styles.bold}>{data.area || '___'} m²</Text>, localizada no lote de matrícula nº... 
        do Cartório de Registro de Imóveis de {data.cidade || 'Firminópolis'}-{data.estado || 'GO'}, situado na..., no Loteamento <Text style={styles.bold}>{data.empreendimentoNome}</Text>, na 
        cidade de {data.cidade || 'Firminópolis'}, Estado de {data.estado || 'Goiás'}.
      </Text>
      <Text style={styles.paragraph}>
        1.2. A construção será executada em estrita conformidade com o Projeto 
        Arquitetônico (Anexo I) e o Memorial Descritivo de Materiais e Acabamentos (Anexo II), 
        documentos que, devidamente rubricados pelas partes, passam a integrar o presente 
        instrumento para todos os fins de direito.
      </Text>
      <Text style={styles.paragraph}>
        1.3. As partes declaram ter ciência de que este contrato se insere no contexto de 
        uma operação de financiamento imobiliário na modalidade "Aquisição de Terreno e 
        Construção", a ser contratada pelo(a) CONTRATANTE junto à Caixa Econômica Federal ou 
        outra instituição financeira, por meio da qual o(a) CONTRATANTE adquire o lote de terreno 
        de terceiro (Grupo XXX) e financia os recursos para a construção objeto deste instrumento.
      </Text>

      <Text style={styles.sectionTitle}>CLÁUSULA SEGUNDA - DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO</Text>
      <Text style={styles.paragraph}>
        2.1. O preço certo e ajustado para a execução completa dos serviços de construção 
        objeto deste contrato é de <Text style={styles.bold}>R$ {formatBRL(data.valorTotal)}</Text>, a ser pago pelo(a) CONTRATANTE à CONSTRUTORA da 
        seguinte forma:
      </Text>
      <Text style={styles.paragraph}>
        a) O valor de <Text style={styles.bold}>R$ 5.000,00 (cinco mil reais)</Text>, a título de taxa de serviços iniciais, que 
        remunera a elaboração de projetos, preenchimento e envio de Planilha de Construção 
        Individual (PCI), acompanhamento de vistorias técnicas e serviços de despachante. 
        Este valor deverá ser pago até o dia.., através de depósito ou transferência para a conta de titularidade 
        da CONSTRUTORA ou chave PIX, conforme instruções fornecidas por esta.
      </Text>
      <Text style={styles.paragraph}>
        b) O valor remanescente de <Text style={styles.bold}>R$ {formatBRL(data.valorTotal - 5000)}</Text> será pago com recursos oriundos do contrato 
        de financiamento imobiliário na modalidade "Aquisição de Terreno e Construção", a ser 
        firmado pelo(a) CONTRATANTE.
      </Text>
      <Text style={styles.paragraph}>
        Parágrafo Primeiro: Fica estabelecido que o valor pago a título de taxa de serviços 
        iniciais, descrito na alínea "a", não será reembolsado em nenhuma hipótese, inclusive em caso 
        de não aprovação do financiamento ou desistência por parte do(a) CONTRATANTE, por se 
        tratar de remuneração por serviços efetivamente prestados.
      </Text>
      <Text style={styles.paragraph}>
        Parágrafo Segundo: O(A) CONTRATANTE declara estar ciente de que, na 
        modalidade de financiamento adotada, os recursos destinados à construção serão liberados 
        em parcelas pela instituição financeira, de acordo com a evolução da obra aferida em 
        medições, e depositados em conta de titularidade do(a) próprio(a) CONTRATANTE.
      </Text>
      <Text style={styles.paragraph}>
        Parágrafo Terceiro: O(A) CONTRATANTE obriga-se, de forma irrevogável e 
        irretratável, a repassar integralmente à CONSTRUTORA cada parcela de recurso liberada pela 
        instituição financeira, no prazo máximo de 2 (dois) dias úteis contados do efetivo crédito em 
        sua conta bancária.
      </Text>
      <Text style={styles.paragraph}>
        Parágrafo Quarto: O não cumprimento da obrigação de repasse no prazo 
        estipulado no parágrafo anterior sujeitará o(a) CONTRATANTE ao pagamento do valor devido, 
        acrescido de multa de 10% (dez por cento), juros de mora de 2% (dois por cento) ao mês e 
        correção monetária pelo Índice Nacional de Custo da Construção (INCC-M/FGV), calculados 
        pro rata die, sem prejuízo das demais sanções previstas neste contrato.
      </Text>
      <Text style={styles.paragraph}>
        Parágrafo Quinto: O atraso no repasse dos valores por período superior a 10 (dez) 
        dias consecutivos autoriza a CONSTRUTORA a paralisar imediatamente a obra, sem 
        necessidade de aviso prévio, sendo o prazo de entrega automaticamente prorrogado por 
        período idêntico ao da paralisação, não cabendo à CONSTRUTORA qualquer penalidade por 
        tal prorrogação.
      </Text>

      <Text style={styles.sectionTitle}>CLÁUSULA TERCEIRA - DO PRAZO DE EXECUÇÃO E ENTREGA</Text>
      <Text style={styles.paragraph}>
        3.1. O prazo para a conclusão integral da obra é de 12 (doze) meses, contados a 
        partir da data de assinatura do contrato de financiamento com a instituição financeira e da 
        emissão do respectivo Alvará de Construção pela Prefeitura Municipal, o 
        que ocorrer por último.
      </Text>
      <Text style={styles.paragraph}>
        3.2. A execução da obra seguirá o Cronograma Físico-Financeiro (PCI/PFF) 
        aprovado pela instituição financeira, o qual serve de referência para as medições e liberações 
        de recursos.
      </Text>
      <Text style={styles.paragraph}>
        3.3. Na hipótese de atraso na entrega da obra por culpa exclusiva da 
        CONSTRUTORA, ressalvadas as excludentes de responsabilidade, esta pagará ao(à) 
        CONTRATANTE, desde que adimplente com suas obrigações, multa penal de 2% (dois por 
        cento) sobre os valores totais já recebidos, acrescida de juros de mora de 1% (um por cento) 
        ao mês, calculados pro rata die até a data da efetiva entrega do imóvel.
      </Text>
      <Text style={styles.paragraph}>
        3.4. O prazo de entrega será prorrogado, sem quaisquer penalidades ou aplicação 
        de multa à CONSTRUTORA, em caso de ocorrência de caso fortuito ou força maior, bem como 
        de fato de terceiro, tais como chuvas prolongadas e anormais para a região, greves, 
        pandemias, desabastecimento generalizado de materiais, atrasos por parte de 
        concessionárias de serviços públicos, órgãos governamentais, bem como atraso, suspensão 
        ou postergação na liberação, repasse ou pagamento de recursos do financiamento pela 
        instituição financeira, por motivos alheios à vontade da CONSTRUTORA, pelo período em que 
        perdurarem tais eventos.
      </Text>

      <Text style={styles.sectionTitle}>CLÁUSULA QUARTA - DAS OBRIGAÇÕES DAS PARTES</Text>
      <Text style={styles.paragraphNoIndent}>4.1. Compete à CONSTRUTORA:</Text>
      <Text style={styles.paragraph}>
        a) Executar a obra com zelo e técnica, em conformidade com os projetos, memoriais e normas técnicas aplicáveis (ABNT).
      </Text>
      <Text style={styles.paragraph}>
        b) Fornecer todos os materiais, equipamentos e mão de obra necessários à completa execução dos serviços contratados.
      </Text>
      <Text style={styles.paragraph}>
        c) Apresentar a Anotação de Responsabilidade Técnica (ART) da obra e de seus projetos, devidamente registrada no CREA.
      </Text>
      <Text style={styles.paragraph}>
        d) Assumir com exclusividade toda a responsabilidade por encargos trabalhistas, previdenciários e acidentários de seus funcionários e prepostos alocados na obra.
      </Text>
      <Text style={styles.paragraph}>
        e) Obter, ao final da construção, o respectivo "Habite-se" junto à Prefeitura Municipal.
      </Text>
      <Text style={styles.paragraph}>
        f) Prestar a garantia legal sobre a solidez e a segurança da obra pelo prazo de 05 (cinco) anos, contados da data de expedição do "Habite-se", e responder por vícios e defeitos construtivos nos termos da legislação vigente.
      </Text>

      <Text style={styles.paragraphNoIndent}>4.2. Compete ao(à) CONTRATANTE:</Text>
      <Text style={styles.paragraph}>
        a) Cumprir rigorosamente a obrigação de repasse dos valores do financiamento, nos termos da Cláusula Segunda.
      </Text>
      <Text style={styles.paragraph}>
        b) Arcar com todos os custos relativos à operação de financiamento, incluindo, mas não se limitando a: Imposto sobre a Transmissão de Bens Imóveis (ITBI), taxas de avaliação da instituição financeira, custas de registro do contrato em cartório e os chamados "juros de obra".
      </Text>
      <Text style={styles.paragraph}>
        c) Após a expedição do "Habite-se" pela CONSTRUTORA, providenciar, às suas expensas, a averbação da construção na matrícula do imóvel.
      </Text>
      <Text style={styles.paragraph}>
        d) Não adentrar o canteiro de obras, nem permitir o acesso de terceiros não autorizados, sem o prévio agendamento e a expressa permissão da CONSTRUTORA, devendo a visita ser sempre acompanhada por um representante desta.
      </Text>
      <Text style={styles.paragraph}>
        e) Notificar a CONSTRUTORA sobre qualquer alteração de endereço, telefone ou e-mail, sob pena de serem consideradas válidas as comunicações enviadas para os dados constantes no preâmbulo.
      </Text>

      <Text style={styles.sectionTitle}>CLÁUSULA QUINTA - DA VISTORIA, ENTREGA E POSSE</Text>
      <Text style={styles.paragraph}>
        5.1. Concluída a obra e expedido o "Habite-se", a CONSTRUTORA notificará o(a) 
        CONTRATANTE para, em até 05 (cinco) dias úteis, realizar a vistoria do imóvel.
      </Text>
      <Text style={styles.paragraph}>
        5.2. A vistoria resultará na lavratura de um "Termo de Vistoria e Recebimento do 
        Imóvel", no qual serão apontadas eventuais pendências e, estando tudo em conformidade, 
        será formalizado o aceite.
      </Text>
      <Text style={styles.paragraph}>
        5.3. O não comparecimento do(a) CONTRATANTE à vistoria agendada, sem 
        justificativa formal e plausível em até 48 (quarenta e oito) horas, implicará na aceitação tácita 
        do imóvel, considerando-se a obra entregue para todos os fins.
      </Text>
      <Text style={styles.paragraph}>
        5.4. A posse definitiva do imóvel e a entrega das chaves ao(à) CONTRATANTE 
        ficam expressamente condicionadas à comprovação do repasse integral de todas as parcelas 
        do financiamento liberadas pela Instituição Financeira e à quitação de quaisquer outros 
        débitos previstos neste contrato.
      </Text>

      <Text style={styles.sectionTitle}>CLÁUSULA SEXTA - DA RESCISÃO</Text>
      <Text style={styles.paragraph}>
        6.1. O presente contrato poderá ser rescindido de pleno direito em caso de 
        inadimplemento de qualquer cláusula, se a parte infratora, notificada extrajudicialmente, não 
        sanar a falta no prazo de 15 (quinze) dias.
      </Text>
      <Text style={styles.paragraph}>
        6.2. Ocorrendo a rescisão por culpa de qualquer das partes, a parte infratora 
        pagará à parte inocente multa penal não compensatória correspondente a 10% (dez por 
        cento) sobre o valor total deste contrato, devidamente atualizado pelo INCC-M/FGV, sem 
        prejuízo da apuração de eventuais perdas e danos.
      </Text>
      <Text style={styles.paragraph}>
        6.3. Caso o financiamento imobiliário não seja aprovado por motivos relacionados 
        a restrições cadastrais do(a) CONTRATANTE que não sejam sanadas no prazo de 30 (trinta) 
        dias da ciência do fato, o contrato será rescindido por sua culpa, aplicando-se a penalidade da 
        cláusula 6.2.
      </Text>

      <Text style={styles.sectionTitle}>CLÁUSULA SÉTIMA - DAS DISPOSIÇÕES GERAIS</Text>
      <Text style={styles.paragraph}>
        7.1. A tolerância de uma das partes quanto ao descumprimento de qualquer 
        obrigação pela outra não constituirá novação, renúncia ou alteração contratual, mas mera 
        liberalidade.
      </Text>
      <Text style={styles.paragraph}>
        7.2. As partes reconhecem a validade jurídica das comunicações e notificações 
        realizadas por e-mail e aplicativos de mensagens com confirmação de recebimento, nos 
        endereços e números informados no preâmbulo.
      </Text>
      <Text style={styles.paragraph}>
        7.3. Este instrumento vincula as partes e seus herdeiros ou sucessores, sendo 
        vedada a cessão dos direitos e obrigações aqui pactuados sem o consentimento prévio e por 
        escrito da outra parte.
      </Text>

      <Text style={styles.sectionTitle}>CLÁUSULA OITAVA - DO FORO</Text>
      <Text style={styles.paragraph}>
        8.1. Para dirimir quaisquer controvérsias oriundas do presente contrato, as partes 
        elegem o foro da Comarca de {data.cidade || 'Firminópolis'}, Estado de {data.estado || 'Goiás'}, com expressa renúncia a qualquer 
        outro, por mais privilegiado que seja.
      </Text>

      <Text style={styles.paragraphNoIndent}>
        E, por estarem assim justas e contratadas, assinam o presente instrumento em 03 
        (três) vias de igual teor e forma, na presença de 02 (duas) testemunhas.
      </Text>

      <Text style={{ marginTop: 20, textAlign: 'right' }}>
        {data.cidade || 'Goiânia'}-{data.estado || 'GO'}, {new Date().toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' })}.
      </Text>

      <View style={styles.signatureArea}>
        <View style={styles.signatureBox}>
          <Text style={styles.bold}>{data.nome.toUpperCase()}</Text>
          <Text style={{ fontSize: 9, marginTop: 4 }}>CONTRATANTE</Text>
        </View>
        <View style={styles.signatureBox}>
          <Text style={styles.bold}>HABITICON CONSTRUÇÃO INTELIGENTE</Text>
          <Text style={{ fontSize: 9, marginTop: 4 }}>CONSTRUTORA</Text>
        </View>
        <View style={styles.signatureBox}>
          <Text>________________________________________________</Text>
          <Text style={{ fontSize: 9, marginTop: 4 }}>TESTEMUNHA 1</Text>
        </View>
        <View style={styles.signatureBox}>
          <Text>________________________________________________</Text>
          <Text style={{ fontSize: 9, marginTop: 4 }}>TESTEMUNHA 2</Text>
        </View>
      </View>

    </Page>
  </Document>
);