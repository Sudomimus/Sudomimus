using System.Net;

namespace Sudomimus.Session.Tests;

/// <summary>
/// Minimal HttpMessageHandler that returns a queue of pre-built responses
/// and records each outgoing request (with body and Authorization header
/// pre-buffered so tests can read them after disposal).
/// </summary>
internal sealed class FakeHttpMessageHandler : HttpMessageHandler
{
    private readonly Queue<HttpResponseMessage> _responses = new();

    public List<RecordedRequest> Requests { get; } = new();

    public void Enqueue(HttpStatusCode status, string? jsonBody)
    {
        var msg = new HttpResponseMessage(status);
        if (jsonBody is not null)
        {
            msg.Content = new StringContent(jsonBody, System.Text.Encoding.UTF8, "application/json");
        }
        _responses.Enqueue(msg);
    }

    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        var body = request.Content is null
            ? null
            : await request.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);

        var authScheme = request.Headers.Authorization?.Scheme;
        var authParam = request.Headers.Authorization?.Parameter;

        Requests.Add(new RecordedRequest(
            request.Method,
            request.RequestUri,
            body,
            authScheme,
            authParam));

        if (_responses.Count == 0)
        {
            throw new InvalidOperationException("No queued response.");
        }
        return _responses.Dequeue();
    }
}

internal sealed record RecordedRequest(
    HttpMethod Method,
    Uri? RequestUri,
    string? Body,
    string? AuthScheme,
    string? AuthParameter);
