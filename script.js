const SHEET_ID = "1uBtpnABQFmFwBnYy05Lz4Sc7HIU1jZQyHlJR3JvZo1g";
const BASE_URL = "https://opensheet.elk.sh";

const ABAS = {
  indicadores: "API_Indicadores",
  categorias: "API_Categorias",
  canais: "API_Canais",
  pagamentos: "API_Pagamentos",
  vendedores: "API_Vendedores",
  regioes: "API_Regioes",
  produtos: "API_TopProdutos"
};

let graficos = {};

document.addEventListener("DOMContentLoaded", () => {
  carregarDashboard();
  setInterval(carregarDashboard, 10000);
});

window.addEventListener("resize", () => {
  carregarDashboard();
});

async function carregarDashboard() {
  try {
    const dados = await buscarDados();

    preencherIndicadores(dados.indicadores);
    preencherTabelas(dados);
    preencherGraficos(dados);
    atualizarHorario();
  } catch (erro) {
    console.error("Erro ao carregar dados:", erro);
    alert("Erro ao carregar os dados. Verifique se a planilha está compartilhada como visualizador.");
  }
}

async function buscarDados() {
  const resultado = {};

  for (const [nome, aba] of Object.entries(ABAS)) {
    resultado[nome] = await buscarAba(aba);
  }

  console.log("Dados carregados:", resultado);
  return resultado;
}

async function buscarAba(nomeAba) {
  try {
    const url = `${BASE_URL}/${SHEET_ID}/${nomeAba}`;
    const resposta = await fetch(url);
    const dados = await resposta.json();

    if (!Array.isArray(dados)) {
      console.warn(`A aba ${nomeAba} não retornou dados válidos`, dados);
      return [];
    }

    return dados.filter(linha =>
      Object.values(linha).some(valor => valor !== null && valor !== "")
    );
  } catch (erro) {
    console.error(`Erro ao buscar a aba ${nomeAba}:`, erro);
    return [];
  }
}

/* INDICADORES */

function preencherIndicadores(indicadores) {
  const mapa = {};

  indicadores.forEach(linha => {
    const indicador = pegarCampo(linha, "Indicador");
    const resultado = pegarCampo(linha, "Resultado");

    if (indicador) {
      mapa[indicador.trim()] = resultado;
    }
  });

  texto("faturamentoTotal", formatarMoeda(mapa["Faturamento total"]));
  texto("totalVendas", formatarInteiro(mapa["Total de vendas"]));
  texto("ticketMedio", formatarMoeda(mapa["Ticket médio"]));
  texto("lucroBruto", formatarMoeda(mapa["Lucro bruto"]));
  texto("quantidadeVendida", formatarInteiro(mapa["Quantidade vendida"]));
  texto("produtoMaisVendido", mapa["Produto mais vendido"] || "-");
}

/* TABELAS */

function preencherTabelas(dados) {
  montarTabela("tabelaCategorias", dados.categorias, [
    "Categoria",
    "Faturamento",
    "Lucro bruto",
    "Qtd vendida",
    "Ticket médio"
  ]);

  montarTabela("tabelaCanais", dados.canais, [
    "Canal",
    "Vendas",
    "Faturamento"
  ]);

  montarTabela("tabelaPagamentos", dados.pagamentos, [
    "Forma pagamento",
    "Vendas",
    "Faturamento"
  ]);

  montarTabela("tabelaRegioes", dados.regioes, [
    "Região",
    "Vendas",
    "Faturamento"
  ]);

  montarTabela("tabelaProdutos", dados.produtos, [
    "Produto",
    "Categoria",
    "Qtd vendida",
    "Faturamento"
  ]);
}

function montarTabela(id, linhas, colunas) {
  const tbody = document.getElementById(id);

  if (!tbody) return;

  tbody.innerHTML = "";

  linhas.forEach(linha => {
    const tr = document.createElement("tr");

    colunas.forEach(coluna => {
      const td = document.createElement("td");
      let valor = pegarCampo(linha, coluna);

      if (ehDinheiro(coluna)) {
        valor = formatarMoeda(valor);
      }

      if (ehInteiro(coluna)) {
        valor = formatarInteiro(valor);
      }

      td.setAttribute("data-label", coluna);
      td.textContent = valor || "-";

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

/* GRÁFICOS */

function preencherGraficos(dados) {
  graficoBarraHorizontal(
    "graficoCategorias",
    dados.categorias,
    "Categoria",
    "Faturamento",
    true
  );

  graficoRoscaPercentual(
    "graficoCanais",
    dados.canais,
    "Canal",
    "Faturamento"
  );

  graficoBarraHorizontal(
    "graficoVendedores",
    dados.vendedores.slice(0, 8),
    "Vendedor",
    "Faturamento",
    true
  );

  graficoBarraHorizontal(
    "graficoProdutos",
    dados.produtos.slice(0, 10),
    "Produto",
    "Qtd vendida",
    false
  );
}

function graficoBarraHorizontal(id, linhas, campoNome, campoValor, dinheiro) {
  destruirGrafico(id);

  const canvas = document.getElementById(id);
  if (!canvas || !linhas || linhas.length === 0) return;

  const mobile = window.innerWidth <= 700;

  const dadosOrdenados = [...linhas].sort(
    (a, b) => numero(pegarCampo(b, campoValor)) - numero(pegarCampo(a, campoValor))
  );

  graficos[id] = new Chart(canvas, {
    type: "bar",
    data: {
      labels: dadosOrdenados.map(linha => abreviarTexto(pegarCampo(linha, campoNome), mobile ? 18 : 34)),
      datasets: [{
        data: dadosOrdenados.map(linha => numero(pegarCampo(linha, campoValor))),
        backgroundColor: "#2563eb",
        borderRadius: 8
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: ctx => dadosOrdenados[ctx[0].dataIndex]
              ? pegarCampo(dadosOrdenados[ctx[0].dataIndex], campoNome)
              : "",
            label: ctx => dinheiro
              ? formatarMoeda(ctx.raw)
              : formatarInteiro(ctx.raw)
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: "#111827",
            font: {
              size: mobile ? 11 : 14
            },
            maxTicksLimit: mobile ? 4 : 6,
            callback: value => dinheiro ? moedaCompacta(value) : formatarInteiro(value)
          },
          grid: { color: "#e5e7eb" }
        },
        y: {
          ticks: {
            color: "#111827",
            font: {
              size: mobile ? 12 : 15,
              weight: "bold"
            }
          },
          grid: { display: false }
        }
      }
    }
  });
}

function graficoRoscaPercentual(id, linhas, campoNome, campoValor) {
  destruirGrafico(id);

  const canvas = document.getElementById(id);
  if (!canvas || !linhas || linhas.length === 0) return;

  const mobile = window.innerWidth <= 700;

  const valores = linhas.map(linha => numero(pegarCampo(linha, campoValor)));
  const total = valores.reduce((soma, valor) => soma + valor, 0);

  graficos[id] = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: linhas.map(linha => pegarCampo(linha, campoNome)),
      datasets: [{
        data: valores,
        backgroundColor: ["#2563eb", "#16a34a", "#f59e0b", "#7c3aed", "#dc2626"],
        borderColor: "#ffffff",
        borderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: mobile ? "58%" : "62%",
      animation: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#111827",
            boxWidth: mobile ? 12 : 16,
            padding: mobile ? 10 : 16,
            font: {
              size: mobile ? 12 : 15,
              weight: "bold"
            },
            generateLabels(chart) {
              return chart.data.labels.map((label, index) => {
                const valor = chart.data.datasets[0].data[index];
                const porcentagem = total > 0 ? ((valor / total) * 100).toFixed(1) : "0.0";

                return {
                  text: `${abreviarTexto(label, mobile ? 14 : 24)}: ${porcentagem}%`,
                  fillStyle: chart.data.datasets[0].backgroundColor[index],
                  strokeStyle: chart.data.datasets[0].backgroundColor[index],
                  index
                };
              });
            }
          }
        },
        tooltip: {
          callbacks: {
            label(ctx) {
              const valor = ctx.raw;
              const porcentagem = total > 0 ? ((valor / total) * 100).toFixed(1) : "0.0";
              return `${formatarMoeda(valor)} (${porcentagem}%)`;
            }
          }
        }
      }
    }
  });
}

function destruirGrafico(id) {
  if (graficos[id]) {
    graficos[id].destroy();
  }
}

/* UTILITÁRIOS */

function pegarCampo(objeto, nome) {
  if (!objeto) return "";

  if (objeto[nome] !== undefined) return objeto[nome];

  const chave = Object.keys(objeto).find(k =>
    normalizar(k) === normalizar(nome)
  );

  return chave ? objeto[chave] : "";
}

function normalizar(texto) {
  return texto
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/_/g, " ")
    .trim();
}

function numero(valor) {
  if (!valor) return 0;

  if (typeof valor === "number") return valor;

  return Number(
    valor
      .toString()
      .replace("R$", "")
      .replace("%", "")
      .replace(/\./g, "")
      .replace(",", ".")
      .trim()
  ) || 0;
}

function formatarMoeda(valor) {
  return numero(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function moedaCompacta(valor) {
  return numero(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1
  });
}

function formatarInteiro(valor) {
  return Math.round(numero(valor)).toLocaleString("pt-BR");
}

function abreviarTexto(texto, limite) {
  if (!texto) return "";

  texto = texto.toString();

  if (texto.length <= limite) return texto;

  return texto.slice(0, limite) + "...";
}

function ehDinheiro(coluna) {
  const c = normalizar(coluna);
  return c.includes("faturamento") || c.includes("lucro") || c.includes("ticket");
}

function ehInteiro(coluna) {
  const c = normalizar(coluna);
  return c.includes("vendas") || c.includes("qtd") || c.includes("quantidade");
}

function texto(id, valor) {
  const elemento = document.getElementById(id);
  if (elemento) elemento.textContent = valor || "-";
}

function atualizarHorario() {
  const agora = new Date();

  texto("ultimaAtualizacao", agora.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }));
}