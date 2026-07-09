import { supabase } from "@/integrations/supabase/client";
import {
  buildFlowXml,
  emptyFlowXml,
  type FlowEdgeInput,
  type FlowLaneInput,
  type FlowNodeInput,
} from "./xmlMapping";
import type { FlowColor, TextColor } from "./colorPalette";

/**
 * Migração única (lazy, por fluxo) das tabelas relacionais antigas
 * (process_flow_nodes/edges/lanes) + canvas_extras pra drawio_xml — ver
 * Fase 3 do plano. Chamada pelo loader de /processos/$id quando
 * drawio_xml ainda é null.
 *
 * Escopo desta primeira versão: nós, raias e arestas migram por
 * completo (mapeamento bem definido, ver xmlMapping.ts). O desenho livre
 * (canvas_extras.strokes/shapes/images) NÃO migra ainda — a serialização
 * exata que o draw.io usa pro traço de lápis precisa ser verificada
 * empiricamente antes de gerar XML pra isso (ver Fase 0 do plano,
 * item ainda pendente). Labels/textboxes migram como notas de texto
 * simples, que é um mapeamento direto e seguro.
 */
export async function migrateLegacyFlowToXml(flowId: string): Promise<string> {
  const [{ data: flow }, { data: lanes }, { data: nodes }, { data: edges }] = await Promise.all([
    supabase.from("process_flows").select("canvas_extras").eq("id", flowId).single(),
    supabase.from("process_flow_lanes").select("*").eq("flow_id", flowId),
    supabase.from("process_flow_nodes").select("*").eq("flow_id", flowId),
    supabase.from("process_flow_edges").select("*").eq("flow_id", flowId),
  ]);

  if (!nodes || nodes.length === 0) {
    return emptyFlowXml();
  }

  const laneInputs: FlowLaneInput[] = (lanes ?? []).map((l) => ({
    id: l.id,
    nome: l.nome,
    tipo: l.tipo as "responsavel" | "fase",
    ordem: l.ordem,
    orientacao: l.orientacao as "horizontal" | "vertical",
  }));

  // Título de exibição: tarefas usam o texto salvo em `texto` como
  // fallback (a versão React Flow resolvia o título ao vivo via join com
  // `tasks`, não guardava cópia — migração usa o que tiver disponível
  // localmente pra não depender de uma segunda consulta por nó aqui).
  const nodeInputs: FlowNodeInput[] = nodes.map((n) => ({
    id: n.id,
    tipo: n.tipo as FlowNodeInput["tipo"],
    label: n.texto ?? "",
    taskId: n.task_id,
    cor: (n.cor as FlowColor) ?? "blue",
    corTexto: (n.cor_texto as TextColor) ?? undefined,
    redFlag: n.red_flag ?? false,
    etapaTipo: (n.etapa_tipo as FlowNodeInput["etapaTipo"]) ?? "intermediaria",
    duracaoEstimadaMinutes: n.duracao_estimada_minutes,
    notaSecundaria: n.comentario,
    x: n.posicao_x,
    y: n.posicao_y,
    width: n.largura_px ?? undefined,
    height: n.altura_px ?? undefined,
    parentId: n.lane_id ?? undefined,
  }));

  const edgeInputs: FlowEdgeInput[] = (edges ?? []).map((e) => ({
    id: e.id,
    sourceId: e.source_node_id,
    targetId: e.target_node_id,
    label: e.label,
  }));

  // Rótulos flutuantes do canvas_extras viram nós de nota simples,
  // posicionados como estavam — o resto do canvas_extras (traços,
  // formas, caixas de texto, imagens) fica de fora por ora (ver docstring
  // acima).
  const canvasExtras = flow?.canvas_extras as {
    labels?: { id: string; x: number; y: number; text: string }[];
  } | null;
  const labelNodes: FlowNodeInput[] = (canvasExtras?.labels ?? []).map((label) => ({
    id: `label-${label.id}`,
    tipo: "nota",
    label: label.text,
    cor: "amber",
    x: label.x,
    y: label.y,
  }));

  return buildFlowXml({
    lanes: laneInputs,
    nodes: [...nodeInputs, ...labelNodes],
    edges: edgeInputs,
  });
}

/** Garante que o fluxo tem drawio_xml — roda a migração e persiste se
 * ainda não tiver sido feita. Idempotente (não re-roda se já existir). */
export async function ensureDrawioXml(flowId: string): Promise<string> {
  const { data, error } = await supabase
    .from("process_flows")
    .select("drawio_xml")
    .eq("id", flowId)
    .single();
  if (error) throw error;

  if (data.drawio_xml) return data.drawio_xml;

  const xml = await migrateLegacyFlowToXml(flowId);
  const { error: updateError } = await supabase
    .from("process_flows")
    .update({ drawio_xml: xml })
    .eq("id", flowId);
  if (updateError) throw updateError;

  return xml;
}
