package com.brasscount.app.audio

import java.util.concurrent.Executor

/**
 * Runs the slow part of stopping a capture (joining the read thread and
 * releasing the recorder) off the calling thread, and lets a later start
 * wait for it, so two recorders are never open at once. Free of android.*
 * so the ordering is unit-testable on the JVM.
 */
internal class CaptureTeardown(private val executor: Executor) {
  private val monitor = Object()
  private var pending = 0

  /** Runs [task] on the executor; [awaitIdle] blocks until it has finished. */
  fun begin(task: () -> Unit) {
    synchronized(monitor) { pending++ }
    try {
      executor.execute {
        try {
          task()
        } finally {
          finished()
        }
      }
    } catch (e: RuntimeException) {
      // The executor refused the task (shut down): do not leave start() waiting.
      finished()
      throw e
    }
  }

  /** Waits up to [timeoutMs] for every teardown begun so far. True when none is left. */
  fun awaitIdle(timeoutMs: Long): Boolean {
    val deadline = System.nanoTime() + timeoutMs * NANOS_PER_MILLI_LONG
    synchronized(monitor) {
      while (pending > 0) {
        val remainingMs = (deadline - System.nanoTime()) / NANOS_PER_MILLI_LONG
        if (remainingMs <= 0) return false
        try {
          (monitor as Object).wait(remainingMs)
        } catch (e: InterruptedException) {
          Thread.currentThread().interrupt()
          return false
        }
      }
      return true
    }
  }

  private fun finished() {
    synchronized(monitor) {
      pending--
      (monitor as Object).notifyAll()
    }
  }

  private companion object {
    const val NANOS_PER_MILLI_LONG = 1_000_000L
  }
}

/** How [openFirstSource] ended. */
internal sealed interface OpenOutcome<out R> {
  data class Opened<R>(val recorder: R) : OpenOutcome<R>

  /** No source would open at all. */
  data object InitFailed : OpenOutcome<Nothing>

  /** At least one source opened but none would record. */
  data object StartFailed : OpenOutcome<Nothing>
}

/**
 * Takes each of [sources] all the way to recording, best first, falling back
 * to the next when one refuses to open ([open] returns null) or refuses to
 * record ([start] returns null).
 */
internal fun <S, R : Any> openFirstSource(
  sources: List<S>,
  open: (S) -> R?,
  start: (R) -> R?,
): OpenOutcome<R> {
  var anySourceOpened = false
  for (source in sources) {
    val opened = open(source) ?: continue
    anySourceOpened = true
    start(opened)?.let {
      return OpenOutcome.Opened(it)
    }
  }
  return if (anySourceOpened) OpenOutcome.StartFailed else OpenOutcome.InitFailed
}
