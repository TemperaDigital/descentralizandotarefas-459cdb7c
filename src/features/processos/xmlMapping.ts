import { COLOR_BG, COLOR_BORDER, TEXT_COLOR, type FlowColor, type TextColor } from "./colorPalette";

/**
 * Construção/leitura do XML mxGraph que passa a ser a fonte de verdade de
 * um fluxo (process_flows.drawio_xml), no lugar das tabelas relacionais
 * antigas (process_flow_nodes/edges/lanes). Mapeamento confirmado
 * empiricamente contra o bundle real do draw.io (round-trip de atributos
 * custom, swimlane nativo, rhombus, terminator — ver spikes na Fase 0/1).
 */

export type EtapaTipo = "inicio" | "intermediaria" | "fim" | "decisao";
export type NodeTipo = "tarefa" | "nota" | "comentario";

export type FlowNodeInput = {
  id: string;
  tipo: NodeTipo;
  label: string;
  taskId?: string | null;
  cor: FlowColor;
  corTexto?: TextColor;
  redFlag?: boolean;
  etapaTipo?: EtapaTipo;
  duracaoEstimadaMinutes?: number | null;
  notaSecundaria?: string | null;
  x: number;
  y: number;
  width?: number;
  height?: number;
  parentId?: string; // id da raia, se houver — senão "1" (root)
};

export type FlowEdgeInput = {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string | null;
};

export type FlowLaneInput = {
  id: string;
  nome: string;
  tipo: "responsavel" | "fase";
  ordem: number;
  orientacao: "horizontal" | "vertical";
  width?: number;
  height?: number;
};

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Calcula o style mxGraph (forma + cores) a partir dos campos de domínio
 * — usado tanto pra serializar um nó novo quanto pela mini-toolbar pra
 * recalcular o style depois de mudar cor/tipo de etapa num nó existente
 * (ver ProcessoToolbar.tsx). */
export function shapeStyleFor(
  node: Pick<FlowNodeInput, "tipo" | "cor" | "corTexto" | "etapaTipo">,
): string {
  const bg = COLOR_BG[node.cor];
  const border = COLOR_BORDER[node.cor];
  const fontColor = TEXT_COLOR[node.corTexto ?? "black"];
  const common = `fillColor=${bg};strokeColor=${border};fontColor=${fontColor};html=1;whiteSpace=wrap;`;

  if (node.tipo !== "comentario" && node.etapaTipo === "decisao") {
    return `rhombus;${common}`;
  }
  if (node.tipo !== "comentario" && (node.etapaTipo === "inicio" || node.etapaTipo === "fim")) {
    return `shape=mxgraph.flowchart.terminator;${common}`;
  }
  const dashed = node.tipo === "comentario" ? "dashed=1;" : "";
  return `rounded=1;${dashed}${common}`;
}

/** Atributos custom de um nó (nodeType/task_id/cor/red_flag/etc.) — mesmo
 * conjunto usado tanto na serialização XML quanto no payload estruturado
 * de inserção via plugin (ver buildInsertNodePayload). */
function nodeAttrs(node: FlowNodeInput): Record<string, string> {
  const attrs: Record<string, string> = { nodeType: node.tipo, cor: node.cor };
  if (node.taskId) attrs.task_id = node.taskId;
  if (node.corTexto) attrs.cor_texto = node.corTexto;
  if (node.redFlag) attrs.red_flag = "1";
  if (node.etapaTipo) attrs.etapa_tipo = node.etapaTipo;
  if (node.duracaoEstimadaMinutes != null) {
    attrs.duracao_estimada_minutes = String(node.duracaoEstimadaMinutes);
  }
  if (node.notaSecundaria) attrs.nota_secundaria = node.notaSecundaria;
  return attrs;
}

/** Um único nó (tarefa/nota/comentário), serializado como UserObject +
 * mxCell — atributos custom sobrevivem ao round-trip intactos (confirmado
 * na Fase 0). Usado para montar o documento completo do fluxo (load
 * inicial / migração), não para inserir um nó num fluxo já aberto — para
 * isso ver buildInsertNodePayload (o {action:'merge'} nativo do draw.io
 * não faz upsert de célula, confirmado empiricamente). */
export function buildNodeCellXml(node: FlowNodeInput): string {
  const attrs = { label: node.label, ...nodeAttrs(node) };
  const attrStr = Object.entries(attrs)
    .map(([k, v]) => `${k}="${escapeXmlAttr(v)}"`)
    .join(" ");
  const style = shapeStyleFor(node);
  const parent = node.parentId ?? "1";
  const w = node.width ?? 180;
  const h = node.height ?? 70;

  return (
    `<UserObject ${attrStr} id="${escapeXmlAttr(node.id)}">` +
    `<mxCell style="${escapeXmlAttr(style)}" vertex="1" parent="${escapeXmlAttr(parent)}">` +
    `<mxGeometry x="${node.x}" y="${node.y}" width="${w}" height="${h}" as="geometry"/>` +
    `</mxCell></UserObject>`
  );
}

export function buildEdgeCellXml(edge: FlowEdgeInput): string {
  const value = edge.label ? ` value="${escapeXmlAttr(edge.label)}"` : "";
  return (
    `<mxCell id="${escapeXmlAttr(edge.id)}"${value} ` +
    `style="edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;" edge="1" parent="1" ` +
    `source="${escapeXmlAttr(edge.sourceId)}" target="${escapeXmlAttr(edge.targetId)}">` +
    `<mxGeometry relative="1" as="geometry"/></mxCell>`
  );
}

const LANE_WIDTH = 900;
const LANE_HEIGHT = 160;

/** Pool + uma swimlane nativa por raia, empilhadas por `ordem`. Retorna o
 * XML das células e o id do pool (para uso como parentId dos nós). */
export function buildLanesXml(lanes: FlowLaneInput[]): { xml: string; poolId: string | null } {
  if (lanes.length === 0) return { xml: "", poolId: null };

  const poolId = "pool-root";
  const horizontal = lanes[0]?.orientacao !== "vertical" ? 0 : 1;
  const totalHeight = lanes.length * LANE_HEIGHT;
  let xml =
    `<mxCell id="${poolId}" style="swimlane;horizontal=${horizontal};startSize=0;" ` +
    `vertex="1" parent="1"><mxGeometry x="40" y="40" width="${LANE_WIDTH}" height="${totalHeight}" as="geometry"/></mxCell>`;

  const sorted = [...lanes].sort((a, b) => a.ordem - b.ordem);
  sorted.forEach((lane, i) => {
    xml +=
      `<UserObject label="${escapeXmlAttr(lane.nome)}" lane_tipo="${lane.tipo}" ordem="${lane.ordem}" id="${escapeXmlAttr(lane.id)}">` +
      `<mxCell style="swimlane;horizontal=${horizontal};startSize=30;" vertex="1" parent="${poolId}">` +
      `<mxGeometry y="${i * LANE_HEIGHT}" width="${LANE_WIDTH}" height="${LANE_HEIGHT}" as="geometry"/>` +
      `</mxCell></UserObject>`;
  });

  return { xml, poolId };
}

export function wrapGraphModel(cellsXml: string): string {
  return `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cellsXml}</root></mxGraphModel>`;
}

/** XML mínimo pra um fluxo novo — canvas em branco. */
export function emptyFlowXml(): string {
  return wrapGraphModel("");
}

export function buildFlowXml(input: {
  lanes?: FlowLaneInput[];
  nodes: FlowNodeInput[];
  edges: FlowEdgeInput[];
}): string {
  const { xml: lanesXml } = buildLanesXml(input.lanes ?? []);
  const nodesXml = input.nodes.map(buildNodeCellXml).join("");
  const edgesXml = input.edges.map(buildEdgeCellXml).join("");
  return wrapGraphModel(lanesXml + nodesXml + edgesXml);
}

/** O draw.io exporta envelopado em <mxfile><diagram>...<mxGraphModel>
 * (confirmado na Fase 0) — o `load` aceita o <mxGraphModel> puro. Essa
 * função aceita os dois formatos e sempre devolve o <mxGraphModel> puro. */
export function unwrapMxfile(xml: string): string {
  const match = xml.match(/<mxGraphModel[\s\S]*<\/mxGraphModel>/);
  return match ? match[0] : xml;
}

/** Payload estruturado (não XML) pra inserir um nó num fluxo já aberto —
 * usado pelo fluxo "Adicionar tarefa ao diagrama" (o node precisa de um
 * tasks.id real antes de existir, então é criado fora do canvas e
 * injetado via a ação customizada {action:'tarefasInsertNode'} tratada
 * pelo plugin no repo fluxograma; o {action:'merge'} nativo do draw.io
 * não serve pra isso — importa como página nova em vez de atualizar a
 * atual, confirmado empiricamente). */
export function buildInsertNodePayload(node: FlowNodeInput): {
  id: string;
  label: string;
  attrs: Record<string, string>;
  style: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
} {
  return {
    id: node.id,
    label: node.label,
    attrs: nodeAttrs(node),
    style: shapeStyleFor(node),
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
  };
}
